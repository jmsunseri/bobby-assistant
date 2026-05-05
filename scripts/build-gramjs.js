const esbuild = require('esbuild');
const { NodeGlobalsPolyfillPlugin } = require('@esbuild-plugins/node-globals-polyfill');
const { NodeModulesPolyfillPlugin } = require('@esbuild-plugins/node-modules-polyfill');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const bundlePath = path.join(rootDir, 'src/pkjs/lib/telegram-bundle.js');
const tempPath = path.join(rootDir, 'src/pkjs/lib/telegram-bundle.temp.js');

esbuild.build({
    // Use minimal entry point for tree-shaking
    entryPoints: [path.join(__dirname, 'telegram-entry.js')],
    bundle: true,
    format: 'iife',
    globalName: 'Telegram',
    outfile: tempPath,
    define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'globalThis',
    },
    platform: 'browser',
    target: ['es2020'],
    // Enable tree-shaking
    treeShaking: true,
    // Ignore source maps for smaller output
    sourcemap: false,
    // Minify identifiers for smaller output (but still readable)
    minifyIdentifiers: false,
    minifySyntax: true,
    // Drop debug info
    drop: ['debugger'],
    // Analyze bundle composition (uncomment for debugging)
    // metafile: true,
    plugins: [
        NodeModulesPolyfillPlugin(),
        NodeGlobalsPolyfillPlugin({
            process: true,
            buffer: true,
        }),
    ],
}).then(() => {
    console.log('esbuild bundle created, transpiling to ES5 with Babel...');

    // Transpile with Babel to ES5
    execSync(`npx babel ${tempPath} --out-file ${bundlePath} --config-file ./babel.config.json`, {
        cwd: __dirname,
        stdio: 'inherit'
    });

    // Prune unused TL schema definitions
    console.log('Pruning unused TL definitions...');
    const pruneScript = path.join(__dirname, 'prune-telegram-bundle.js');
    try {
        execSync(`node ${pruneScript} ${bundlePath}`, { stdio: 'inherit' });
    } catch (e) {
        console.log('Warning: Pruning failed, continuing with full bundle');
    }

    // Prepend banner
    const banner = `// Telegram/GramJS bundle for Clawd
// Run 'npm install && npm run build:telegram' in scripts/ directory to rebuild
// Polyfills for browser environment
if (typeof globalThis === 'undefined') {
    if (typeof global !== 'undefined') globalThis = global;
    else if (typeof window !== 'undefined') globalThis = window;
    else if (typeof self !== 'undefined') globalThis = self;
}
// Expose Node's crypto module for the esbuild polyfill fallback
// Must be on global scope since the IIFE can't access module-scope vars
if (typeof globalThis.__nodeCrypto === 'undefined') {
    if (typeof require === 'function' && typeof module !== 'undefined') {
        try { globalThis.__nodeCrypto = require('crypto'); } catch(e) {}
    }
}

`;

    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    fs.writeFileSync(bundlePath, banner + bundleContent);

    // Append footer
    const footer = `
// Expose TelegramClient and StringSession as globals for Clawd
if (typeof Telegram !== 'undefined') {
    if (Telegram.TelegramClient) {
        (typeof window !== 'undefined' ? window : global).TelegramClient = Telegram.TelegramClient;
    }
    if (Telegram.StringSession) {
        (typeof window !== 'undefined' ? window : global).StringSession = Telegram.StringSession;
    }
    if (Telegram.NewMessage) {
        (typeof window !== 'undefined' ? window : global).NewMessage = Telegram.NewMessage;
    }
}
`;
    fs.appendFileSync(bundlePath, footer);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Fix empty crypto polyfill from esbuild
    // esbuild's NodeModulesPolyfillPlugin replaces 'crypto' with an empty object
    // Inside the IIFE, 'require' is the bundle's own loader, not Node's
    // So we expose Node's crypto on the global and reference it from the polyfill
    let code = fs.readFileSync(bundlePath, 'utf8');

    // Patch the main crypto polyfill (CryptoFile)
    // On Node: use globalThis.__nodeCrypto (Node's crypto module)
    // On browser/Pebble: the browser 'crypto' object only has getRandomValues/subtle,
    // but GramJS needs randomBytes, sha1, sha256, createHash, pbkdf2Sync.
    // We create a proxy object that delegates to require_crypto2 when available,
    // since require_crypto2 is defined later in the bundle.
    code = code.replace(
        /crypto_default=\{\}/g,
        `crypto_default=(globalThis.__nodeCrypto)?globalThis.__nodeCrypto:(function(){var _c2=null;function getC2(){if(_c2)return _c2;if(typeof __crypto2Fallback!=="undefined")return _c2=__crypto2Fallback;return _c2;}return{get randomBytes(){return getC2()&&getC2().randomBytes;},get createHash(){return getC2()&&getC2().createHash;},get pbkdf2Sync(){return getC2()&&getC2().pbkdf2Sync;},get sha1(){return getC2()&&getC2().sha1;},get sha256(){return getC2()&&getC2().sha256;}};})()`
    );
    // After require_crypto2 is defined, save its exports as globalThis.__crypto2Fallback
    // so the lazy proxy in crypto_default can find these functions
    code = code.replace(
        /function createHash\(algorithm\)\{return new Hash\(algorithm\);\}\}\}\);\/\/ node_modules\/telegram\/crypto\/CTR\.js/,
        `function createHash(algorithm){return new Hash(algorithm);}globalThis.__crypto2Fallback={randomBytes:randomBytes,createHash:createHash,pbkdf2Sync:pbkdf2Sync,sha1:function(d){var h=createHash("sha1");return h.update(d),h.digest();},sha256:function(d){var h=createHash("sha256");return h.update(d),h.digest();}};}});// node_modules/telegram/crypto/CTR.js`
    );

    // Patch the browser crypto module's randomBytes to use Node crypto when available
    // randomBytes returns raw Uint8Array which breaks Buffer.concat in Node
    // Pattern may vary between esbuild/Babel versions, so use flexible regex
    code = code.replace(
        /function randomBytes\(count\)\{var bytes=new Uint8Array\(count\);return crypto\.getRandomValues\(bytes\),bytes;\}/,
        `function randomBytes(count){if(globalThis.__nodeCrypto&&globalThis.__nodeCrypto.randomBytes){return globalThis.__nodeCrypto.randomBytes(count);}var bytes=new Uint8Array(count);crypto.getRandomValues(bytes);return Buffer2.from(bytes);}`
    );
    // Also handle alternate pattern with Buffer2.from
    code = code.replace(
        /function randomBytes\(count\)\{[^}]*crypto\.getRandomValues[^}]*Buffer2\.from[^}]*\}/,
        `function randomBytes(count){if(globalThis.__nodeCrypto&&globalThis.__nodeCrypto.randomBytes){return globalThis.__nodeCrypto.randomBytes(count);}var bytes=new Uint8Array(count);crypto.getRandomValues(bytes);return Buffer2.from(bytes);}`
    );

    // Patch Hash.digest() to use Node crypto.subtle when available
    // The Hash class uses self.crypto.subtle.digest which is async and browser-only
    // We patch 'self.crypto.subtle.digest' calls to use Node's crypto.subtle.digest instead
    // This requires patching the Hash class's digest method

    // Patch Buffer2.concat to accept Uint8Array by converting them to Buffer
    // This is critical for Node.js where crypto operations and WebSocket data
    // may return Uint8Array instead of Buffer2 instances
    code = code.replace(
        /Buffer2\.concat=function\(list,length\)\{if\(!Array\.isArray\(list\)\)throw new TypeError\('"list" argument must be an Array of Buffers'\);if\(list\.length===0\)return Buffer2\.alloc\(0\);/g,
        `Buffer2.concat=function(list,length){for(var i=0;i<list.length;i++){if(list[i]&&!(list[i] instanceof Buffer2)){list[i]=Buffer2.from(list[i]);}}if(!Array.isArray(list))throw new TypeError('"list" argument must be an Array of Buffers');if(list.length===0)return Buffer2.alloc(0);`
    );

    // Patch Buffer2.equals and Buffer2.compare to accept Uint8Array by converting first
    code = code.replace(
        /Buffer2\.prototype\.equals=function\(b\)\{if\(!internalIsBuffer\(b\)\)throw new TypeError\("Argument must be a Buffer"\);return this===b\?!0:Buffer2\.compare\(this,b\)===0;\}/,
        `Buffer2.prototype.equals=function(b){if(b instanceof Uint8Array&&!internalIsBuffer(b)){b=Buffer2.from(b.buffer,b.byteOffset,b.byteLength);}if(!internalIsBuffer(b))throw new TypeError("Argument must be a Buffer");return this===b?!0:Buffer2.compare(this,b)===0;}`
    );
    code = code.replace(
        /Buffer2\.compare=function\(a,b\)\{if\(!internalIsBuffer\(a\)\|\|!internalIsBuffer\(b\)\)throw new TypeError\("Arguments must be Buffers"\);if\(a===b\)return 0;/,
        `Buffer2.compare=function(a,b){if(a instanceof Uint8Array&&!internalIsBuffer(a)){a=Buffer2.from(a.buffer,a.byteOffset,a.byteLength);}if(b instanceof Uint8Array&&!internalIsBuffer(b)){b=Buffer2.from(b.buffer,b.byteOffset,b.byteLength);}if(!internalIsBuffer(a)||!internalIsBuffer(b))throw new TypeError("Arguments must be Buffers");if(a===b)return 0;`
    );

    fs.writeFileSync(bundlePath, code);
    console.log('Patched crypto polyfill');

    console.log('Bundle created successfully!');
    console.log('Output:', bundlePath);
}).catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
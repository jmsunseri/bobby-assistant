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
// Build time: ${new Date().toISOString()}
// Polyfills for JS runtimes without Web Crypto API
if (typeof globalThis === 'undefined') {
    if (typeof global !== 'undefined') globalThis = global;
    else if (typeof window !== 'undefined') globalThis = window;
    else if (typeof self !== 'undefined') globalThis = self;
}
// Expose Node's crypto module for the esbuild polyfill fallback
if (typeof globalThis.__nodeCrypto === 'undefined') {
    if (typeof require === 'function' && typeof module !== 'undefined') {
        try { globalThis.__nodeCrypto = require('crypto'); } catch(e) {}
    }
}
(function(){
var _nc = globalThis.__nodeCrypto;
function _sha1(msg) {
    msg = msg.slice();
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while ((msg.length % 64) !== 56) msg.push(0);
    msg.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
    var K = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];
    var H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    for (var off = 0; off < msg.length; off += 64) {
        var W = [];
        for (var i = 0; i < 16; i++) W[i] = (msg[off+i*4]<<24)|(msg[off+i*4+1]<<16)|(msg[off+i*4+2]<<8)|msg[off+i*4+3];
        for (var i = 16; i < 80; i++) { var n = W[i-3]^W[i-8]^W[i-14]^W[i-16]; W[i] = (n<<1)|(n>>>31); }
        var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4];
        for (var i = 0; i < 80; i++) {
            var f,k;
            if (i<20){f=(b&c)|(~b&d);k=K[0];}
            else if(i<40){f=b^c^d;k=K[1];}
            else if(i<60){f=(b&c)|(b&d)|(c&d);k=K[2];}
            else{f=b^c^d;k=K[3];}
            var t=(((a<<5)|(a>>>27))+f+e+k+W[i])&0xffffffff;
            e=d;d=c;c=(b<<30)|(b>>>2);b=a;a=t;
        }
        H[0]=(H[0]+a)&0xffffffff;H[1]=(H[1]+b)&0xffffffff;H[2]=(H[2]+c)&0xffffffff;H[3]=(H[3]+d)&0xffffffff;H[4]=(H[4]+e)&0xffffffff;
    }
    var r=[];
    for(var i=0;i<5;i++){r.push((H[i]>>>24)&0xff,(H[i]>>>16)&0xff,(H[i]>>>8)&0xff,H[i]&0xff);}
    return r;
}
function _sha256(msg) {
    msg = msg.slice();
    var bitLen = msg.length * 8;
    msg.push(0x80);
    while ((msg.length % 64) !== 56) msg.push(0);
    msg.push(0,0,0,0,(bitLen>>>24)&0xff,(bitLen>>>16)&0xff,(bitLen>>>8)&0xff,bitLen&0xff);
    var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    for(var off=0;off<msg.length;off+=64){
        var W=[];
        for(var i=0;i<16;i++)W[i]=((msg[off+i*4]<<24)|(msg[off+i*4+1]<<16)|(msg[off+i*4+2]<<8)|msg[off+i*4+3])>>>0;
        for(var i=16;i<64;i++){var s0=((W[i-15]>>>7)|(W[i-15]<<25))^((W[i-15]>>>18)|(W[i-15]<<14))^(W[i-15]>>>3);var s1=((W[i-2]>>>17)|(W[i-2]<<15))^((W[i-2]>>>19)|(W[i-2]<<13))^(W[i-2]>>>10);W[i]=((W[i-16]+s0+W[i-7]+s1)&0xffffffff)>>>0;}
        var a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
        for(var i=0;i<64;i++){var S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));var ch=(e&f)^(~e&g);var t1=(h+S1+ch+K[i]+W[i])&0xffffffff;var S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));var maj=(a&b)^(a&c)^(b&c);var t2=(S0+maj)&0xffffffff;h=g;g=f;f=e;e=(d+t1)&0xffffffff;d=c;c=b;b=a;a=(t1+t2)&0xffffffff;}
        H[0]=(H[0]+a)&0xffffffff;H[1]=(H[1]+b)&0xffffffff;H[2]=(H[2]+c)&0xffffffff;H[3]=(H[3]+d)&0xffffffff;H[4]=(H[4]+e)&0xffffffff;H[5]=(H[5]+f)&0xffffffff;H[6]=(H[6]+g)&0xffffffff;H[7]=(H[7]+h)&0xffffffff;
    }
    var r=[];
    for(var i=0;i<8;i++){r.push((H[i]>>>24)&0xff,(H[i]>>>16)&0xff,(H[i]>>>8)&0xff,H[i]&0xff);}
    return r;
}
function _pbkdf2(pwd, salt, iter, dkLen, hashFn) {
    var U=new Array(salt.length+4);
    for(var i=0;i<salt.length;i++)U[i]=salt[i];
    var dk=[];
    var blocks=Math.ceil(dkLen/hashFn([]).length);
    for(var block=1;blocks>=block;block++){
        U[salt.length]=block>>>24&0xff;U[salt.length+1]=block>>>16&0xff;U[salt.length+2]=block>>>8&0xff;U[salt.length+3]=block&0xff;
        var T=hashFn(pwd.concat(U));
        for(var i=1;i<iter;i++){T=hashFn(pwd.concat(T));}
        for(var i=0;i<T.length&&dk.length<dkLen;i++)dk.push(T[i]);
    }
    return dk;
}
var _sha1Hash=function(d){return _sha1([].slice.call(d));};
var _sha256Hash=function(d){return _sha256([].slice.call(d));};
var _crypto;
if (_nc) {
    _crypto = { subtle: {} };
    _crypto.getRandomValues = function(arr) {
        var buf = _nc.randomBytes(arr.length);
        for (var i = 0; i < arr.length; i++) arr[i] = buf[i];
        return arr;
    };
    _crypto.subtle.digest = function(algo, data) {
        var nodeAlgo = algo === 'SHA-1' ? 'sha1' : algo === 'SHA-256' ? 'sha256' : algo.toLowerCase();
        return Promise.resolve(_nc.createHash(nodeAlgo).update(Buffer.from(data)).digest());
    };
    _crypto.subtle.importKey = function() { return Promise.resolve({}); };
    _crypto.subtle.deriveBits = function(algo, key, bits) {
        var buf = _nc.pbkdf2Sync(algo.password || new Uint8Array(0), Buffer.from(algo.salt), algo.iterations, bits / 8, algo.hash === 'SHA-512' ? 'sha512' : 'sha256');
        return Promise.resolve(buf);
    };
} else {
    _crypto = { subtle: {} };
    _crypto.getRandomValues = function(arr) {
        for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    };
    _crypto.subtle.digest = function(algo, data) {
        var fn = algo === 'SHA-1' ? _sha1Hash : _sha256Hash;
        return Promise.resolve(new Uint8Array(fn(data)));
    };
    _crypto.subtle.importKey = function() { return Promise.resolve({}); };
    _crypto.subtle.deriveBits = function(algo, key, bits) {
        var fn = algo.hash === 'SHA-512' ? null : (algo.hash === 'SHA-256' ? _sha256Hash : _sha1Hash);
        if (!fn) return Promise.reject(new Error('SHA-512 PBKDF2 not supported without Node crypto'));
        var dk = _pbkdf2([].slice.call(algo.password || []), [].slice.call(algo.salt), algo.iterations, bits / 8, fn);
        return Promise.resolve(new Uint8Array(dk));
    };
}
if (typeof globalThis.crypto === 'undefined') globalThis.crypto = _crypto;
if (typeof self !== 'undefined' && typeof self.crypto === 'undefined') self.crypto = _crypto;
if (typeof window !== 'undefined' && typeof window.crypto === 'undefined') window.crypto = _crypto;
})();
function _safeAddEventListener(target, type, listener, options) {
    try { target.addEventListener(type, listener, options); } catch(e) {}
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

    // Patch the crypto polyfill (CryptoFile) to include GramJS's browser crypto shim.
    // esbuild's NodeModulesPolyfillPlugin replaces 'crypto' with an empty object {}.
    // GramJS's CryptoFile imports this and expects randomBytes, sha1, sha256, etc.
    // On Node, globalThis.__nodeCrypto has everything. On Pebble/browser, we need
    // to merge in the functions from require_crypto2 (GramJS's own browser crypto).
    // Since require_crypto2 is registered before its factory is first called,
    // we can call it from inside require_crypto's factory and merge exports.
    code = code.replace(
        /crypto_default=\{\}/g,
        `crypto_default=(globalThis.__nodeCrypto)?globalThis.__nodeCrypto:{};`
    );
    // Patch require_crypto's factory to merge in require_crypto2's exports.
    // This ensures crypto_default has randomBytes, createHash, pbkdf2Sync, sha1, sha256
    // regardless of whether __nodeCrypto is available.
    code = code.replace(
        /var polyfill=\(init_crypto\(\),__toCommonJS\(crypto_exports\)\);if\(polyfill&&polyfill\.default\)\{module\.exports=polyfill\.default;for\(var k in polyfill\)module\.exports\[k\]=polyfill\[k\];\}else polyfill&&\(module\.exports=polyfill\);/,
        `var polyfill=(init_crypto(),__toCommonJS(crypto_exports));if(polyfill&&polyfill.default){module.exports=polyfill.default;for(var k in polyfill)module.exports[k]=polyfill[k];}else polyfill&&(module.exports=polyfill);try{console.log("[crypto] merging require_crypto2 into crypto polyfill");var c2=require_crypto2();console.log("[crypto] c2 type:",typeof c2);console.log("[crypto] c2.randomBytes:",typeof(c2&&c2.randomBytes));if(c2){if(!module.exports.randomBytes&&c2.randomBytes)module.exports.randomBytes=c2.randomBytes;if(!module.exports.createHash&&c2.createHash)module.exports.createHash=c2.createHash;if(!module.exports.pbkdf2Sync&&c2.pbkdf2Sync)module.exports.pbkdf2Sync=c2.pbkdf2Sync;if(!module.exports.sha1&&c2.sha1)module.exports.sha1=c2.sha1;if(!module.exports.sha256&&c2.sha256)module.exports.sha256=c2.sha256;}console.log("[crypto] module.exports.randomBytes:",typeof module.exports.randomBytes);}catch(e){console.log("[crypto] error merging crypto2:",e.message);}`
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

    // Append build timestamp to GramJS version log
    const buildTime = new Date().toISOString();
    code = code.replace(
        /Running gramJS version "\+__1\.version\)/,
        `Running gramJS version "+__1.version+", bundle built: "+${JSON.stringify(buildTime)})`
    );
    code = code.replace(
        /CryptoFile_1=__importDefault2\(require_CryptoFile\(\)\),platform_1=require_platform\(\);/,
        `CryptoFile_1=__importDefault2(require_CryptoFile()),platform_1=require_platform();(function(){var cf=CryptoFile_1.default;console.log("[diagnostic] CryptoFile_1.default type:",typeof cf,"randomBytes:",typeof cf==="object"?typeof cf.randomBytes:"no-obj","sha1:",typeof cf==="object"?typeof cf.sha1:"no-obj","createHash:",typeof cf==="object"?typeof cf.createHash:"no-obj");})();`
    );
    code = code.replace(
        /Buffer2\.prototype\.equals=function\(b\)\{if\(!internalIsBuffer\(b\)\)throw new TypeError\("Argument must be a Buffer"\);return this===b\?!0:Buffer2\.compare\(this,b\)===0;\}/,
        `Buffer2.prototype.equals=function(b){if(b instanceof Uint8Array&&!internalIsBuffer(b)){b=Buffer2.from(b.buffer,b.byteOffset,b.byteLength);}if(!internalIsBuffer(b))throw new TypeError("Argument must be a Buffer");return this===b?!0:Buffer2.compare(this,b)===0;}`
    );
    code = code.replace(
        /Buffer2\.compare=function\(a,b\)\{if\(!internalIsBuffer\(a\)\|\|!internalIsBuffer\(b\)\)throw new TypeError\("Arguments must be Buffers"\);if\(a===b\)return 0;/,
        `Buffer2.compare=function(a,b){if(a instanceof Uint8Array&&!internalIsBuffer(a)){a=Buffer2.from(a.buffer,a.byteOffset,a.byteLength);}if(b instanceof Uint8Array&&!internalIsBuffer(b)){b=Buffer2.from(b.buffer,b.byteOffset,b.byteLength);}if(!internalIsBuffer(a)||!internalIsBuffer(b))throw new TypeError("Arguments must be Buffers");if(a===b)return 0;`
    );

    code = code.replace(
        /platform_1\.isBrowser&&window\.addEventListener\("offline"/g,
        'platform_1.isBrowser&&_safeAddEventListener(window,"offline"'
    );

    fs.writeFileSync(bundlePath, code);
    console.log('Patched crypto polyfill');

    console.log('Bundle created successfully!');
    console.log('Output:', bundlePath);
}).catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
});
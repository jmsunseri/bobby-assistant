var loaded = false;

function ensureTelegramBundle() {
    if (!loaded) {
        console.log('[bundle] Loading Telegram bundle...');
        try {
            require('./telegram-bundle.js');
            loaded = true;
            console.log('[bundle] Telegram bundle loaded successfully');
            console.log('[bundle] TelegramClient available: ' + (typeof TelegramClient !== 'undefined'));
            console.log('[bundle] StringSession available: ' + (typeof StringSession !== 'undefined'));
            console.log('[bundle] TelegramApi available: ' + (typeof TelegramApi !== 'undefined'));
            if (typeof TelegramApi !== 'undefined') {
                console.log('[bundle] TelegramApi.auth.SignIn available: ' + (typeof TelegramApi.auth !== 'undefined' && typeof TelegramApi.auth.SignIn !== 'undefined'));
            }
        } catch (err) {
            console.error('[bundle] Failed to load Telegram bundle: ' + (err.message || err));
            console.error('[bundle] Stack: ' + (err.stack || 'no stack'));
        }
    }
}

exports.ensureTelegramBundle = ensureTelegramBundle;
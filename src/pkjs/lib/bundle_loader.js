var loaded = false;

function ensureTelegramBundle() {
    if (!loaded) {
        if (typeof window === 'undefined') {
            global.window = { location: { protocol: 'https:' } };
        } else if (!window.location) {
            window.location = { protocol: 'https:' };
        }
        require('./telegram-bundle.js');
        loaded = true;
    }
}

exports.ensureTelegramBundle = ensureTelegramBundle;
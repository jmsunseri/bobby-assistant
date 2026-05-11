var loaded = false;

function ensureTelegramBundle() {
    if (!loaded) {
        if (typeof window === 'undefined') {
            global.window = { location: { protocol: 'https:' } };
        } else {
            if (!window.location) {
                window.location = { protocol: 'https:' };
            }
            if (!window.addEventListener) {
                window.addEventListener = function() {};
            }
            if (!window.removeEventListener) {
                window.removeEventListener = function() {};
            }
        }
        require('./telegram-bundle.js');
        loaded = true;
    }
}

exports.ensureTelegramBundle = ensureTelegramBundle;
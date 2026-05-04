var loaded = false;

function ensureTelegramBundle() {
    if (!loaded) {
        require('./telegram-bundle.js');
        loaded = true;
    }
}

exports.ensureTelegramBundle = ensureTelegramBundle;
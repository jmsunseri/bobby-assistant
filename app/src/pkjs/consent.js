/**
 * Bundled consent/disclosure.
 *
 * There is no consent server in this build: the text lives in the app and the
 * version is a local constant. This is the list of third parties the phone
 * contacts directly when the agent runs.
 */

var messageQueue = require('./lib/message_queue').Queue;

var DISCLOSURE_VERSION = 2;

var PAGES = [
    {
        title: 'Where your words go',
        text: 'Bobby runs on your phone. Your prompts are sent directly from the phone to Cloudflare Workers AI, which uses decision and extraction models and the language model you chose. There is no Bobby or Rebble server in the middle, and this build does not send usage or quota data anywhere.'
    },
    {
        title: 'Other services',
        text: 'Depending on what you ask, the phone may also contact Open-Meteo for weather, ExchangeRate-API for currency, Brave Search for web results, and Mapbox for geocoding. These only happen when the relevant tool is used and a key is configured. Your API keys stay in the phone\'s local storage.'
    },
    {
        title: 'AI can be wrong',
        text: 'Bobby is an AI assistant. It can mishear you, misunderstand you, or produce incorrect or inappropriate answers. Check anything important. You can review this notice again from the Legal screen.'
    }
];

var LOCATION_PAGE = {
    title: 'Location',
    text: 'Bobby can use your location so that "here" works for weather and other local questions. Location is read on the phone and is only sent to the service handling the current request. You can change this later in the app settings.'
};

function sendPage(index, page) {
    messageQueue.enqueue({
        CONSENT_VERSION: DISCLOSURE_VERSION,
        CONSENT_PAGE_COUNT: PAGES.length + 1,
        CONSENT_PAGE_INDEX: index,
        CONSENT_PAGE_TITLE: page.title,
        CONSENT_PAGE_TEXT: page.text
    });
}

exports.refresh = function() {
    console.log('Bundled disclosure version: ' + DISCLOSURE_VERSION);
    messageQueue.enqueue({
        CONSENT_REQUIRED_VERSION: DISCLOSURE_VERSION
    });
};

exports.handleRequest = function() {
    for (var i = 0; i < PAGES.length; i++) {
        sendPage(i, PAGES[i]);
    }
    sendPage(PAGES.length, LOCATION_PAGE);
};

exports.VERSION = DISCLOSURE_VERSION;
exports.PAGES = PAGES;

/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var bundleLoader = require('./lib/bundle_loader');
var ensureTelegramBundle = bundleLoader.ensureTelegramBundle;

var location = require('./location');
var session = require('./session');
var telegram = require('./telegram');
var Clay = require('@rebble/clay');
var clayConfig = require('./config.json');
var customConfigFunction = require('./custom_config');
var config = require('./config');
var reminders = require('./reminders');
var package_json = require('package.json');


var clay = new Clay(clayConfig, customConfigFunction);

function main() {
    location.update();
    sendTelegramStatus();
    Pebble.addEventListener('appmessage', handleAppMessage);
}

function sendTelegramStatus() {
    var isConnected = telegram.hasSession();
    console.log('Telegram connected: ' + isConnected);
    Pebble.sendAppMessage({
        TELEGRAM_CONNECTED: isConnected ? 1 : 0
    });
}

function handleTelegramSendCode(action) {
    console.log('[index] Sending verification code to: ' + action.phoneNumber);
    telegram.sendCode(action.phoneNumber).then(function(result) {
        console.log('[index] Code sent successfully: ' + JSON.stringify(result));
        config.setSetting('clay_telegram_auth_state', JSON.stringify({
            waitingForCode: true,
            phoneNumber: action.phoneNumber
        }));
        sendTelegramStatus();
    }).catch(function(err) {
        console.error('[index] Failed to send code: ' + err.message);
    });
}

function handleTelegramSignIn(action) {
    console.log('[index] Signing in with code');
    telegram.signIn(action.code).then(function(result) {
        console.log('[index] Sign in result: ' + JSON.stringify(result));
        if (result.status === '2fa_required') {
            console.log('[index] 2FA required - user needs to provide password');
            config.setSetting('clay_telegram_auth_state', JSON.stringify({
                waitingForCode: false,
                needs2FA: true,
                phoneNumber: telegram.getAuthState().phoneNumber
            }));
        } else {
            config.setSetting('clay_telegram_auth_state', '');
        }
        sendTelegramStatus();
    }).catch(function(err) {
        console.error('[index] Failed to sign in: ' + err.message);
    });
}

function handleTelegramDisconnect() {
    console.log('[index] Disconnecting from Telegram');
    telegram.logout().then(function() {
        console.log('[index] Disconnected successfully');
        config.setSetting('clay_telegram_auth_state', '');
        sendTelegramStatus();
    }).catch(function(err) {
        console.error('[index] Failed to disconnect: ' + err.message);
    });
}

function handleTelegramAction(action) {
    if (action.action === 'send_code' && action.phoneNumber) {
        handleTelegramSendCode(action);
    } else if (action.action === 'sign_in' && action.code) {
        handleTelegramSignIn(action);
    } else if (action.action === 'disconnect') {
        handleTelegramDisconnect();
    } else {
        console.log('[index] Unknown or incomplete telegram action: ' + JSON.stringify(action));
    }
}

function handleAppMessage(e) {
    console.log("Inbound app message!");
    console.log(JSON.stringify(e));
    var data = e.payload;
    if (data.PROMPT) {
        console.log("Starting a new Session...");
        var s = new session.Session(data.PROMPT, data.THREAD_ID);
        s.run();
        return;
    }

    if (reminders.handleReminderMessage(data)) {
        return;
    }

    if ('TELEGRAM_PENDING_ACTION' in data) {
        ensureTelegramBundle();
        var action = {};
        try { action = JSON.parse(data.TELEGRAM_PENDING_ACTION); } catch (e) { console.error('[index] Failed to parse TELEGRAM_PENDING_ACTION: ' + data.TELEGRAM_PENDING_ACTION); }
        console.log('[index] Telegram pending action: ' + JSON.stringify(action));
        telegram.initClient().then(function() {
            console.log('[index] Telegram client initialized');
            handleTelegramAction(action);
        }).catch(function(err) {
            console.error('[index] Failed to initialize Telegram client: ' + err.message);
        });
        return;
    }

    if ('LOCATION_ENABLED' in data) {
        config.setSetting("LOCATION_ENABLED", !!data.LOCATION_ENABLED);
        console.log("Location enabled: " + config.isLocationEnabled());
        // We need to confirm that we received this for the watch to proceed.
        Pebble.sendAppMessage({
            LOCATION_ENABLED: data.LOCATION_ENABLED,
        });
    }
}

function doCobbleWarning() {
    if (window.cobble) {
        console.log("WARNING: Running Clawd on Cobble is not supported, and has multiple known issues.");
        Pebble.sendAppMessage({COBBLE_WARNING: 1});
    }
}

Pebble.addEventListener("ready",
    function(e) {
        // This happens before anything else because I don't trust Cobble to get through the normal flow,
        // given how many things bizarrely don't work.
        doCobbleWarning();
        console.log("Clawd " + package_json['version']);

        // Timeline token only available on real devices, not emulator
        if (Pebble.platform !== 'pypkjs' && Pebble.getTimelineToken) {
            Pebble.getTimelineToken(function(token) {
                session.userToken = token;
                main();
            }, function(e) {
                console.log("Get timeline token failed???", e);
                main(); // Continue anyway
            });
        } else {
            console.log("Entering emulator mode.");
            main();
        }
    }
);

// Export function to notify watch of Telegram status changes
exports.updateTelegramStatus = function() {
    sendTelegramStatus();
};
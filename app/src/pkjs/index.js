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

var location = require('./location');
var session = require('./session');
var Clay = require('@rebble/clay');
var clayConfig = require('./config.json');
var customConfigFunction = require('./custom_config');
var config = require('./config');
var reminders = require('./reminders');
var consent = require('./consent');
var history = require('./agent/history');
var package_json = require('package.json');

var ISSUES_URL = 'https://github.com/jmsunseri/bobby-assistant/issues';

// Clay stores all settings in localStorage, but only these are meaningful to
// the watch. API keys deliberately stay on the phone and are never sent over
// AppMessage.
var WATCH_SETTINGS = {
    LANGUAGE_CODE: true,
    UNIT_PREFERENCE: true,
    LOCATION_ENABLED: true,
    ALARM_VIBE_PATTERN: true,
    TIMER_VIBE_PATTERN: true,
    QUICK_LAUNCH_BEHAVIOUR: true,
    CONFIRM_TRANSCRIPTS: true
};

var clay = new Clay(clayConfig, customConfigFunction, { autoHandleEvents: false });

Pebble.addEventListener('showConfiguration', function() {
    Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener('webviewclosed', function(e) {
    if (!e || !e.response) {
        return;
    }
    var raw = clay.getSettings(e.response, false);
    var forWatch = {};
    for (var key in raw) {
        if (raw.hasOwnProperty(key) && WATCH_SETTINGS[key]) {
            forWatch[key] = raw[key];
        }
    }
    Pebble.sendAppMessage(Clay.prepareSettingsForAppMessage(forWatch), function() {
        console.log('Sent watch settings.');
    }, function(error) {
        console.log('Failed to send watch settings: ' + JSON.stringify(error));
    });
});

function main() {
    location.update();
    consent.refresh();
    Pebble.addEventListener('appmessage', handleAppMessage);
}

function handleAppMessage(e) {
    console.log("Inbound app message!");
    console.log(JSON.stringify(e));
    var data = e.payload;
    if (data.PROMPT) {
        console.log("Starting a new Session...");
        var s = new session.Session(data.PROMPT, data.THREAD_ID, data.CONSENT_VERSION);
        s.run();
        return;
    }

    if (reminders.handleReminderMessage(data)) {
        return;
    }

    if (data.CONSENT_REQUEST) {
        console.log("Sending consent pages...");
        consent.handleRequest();
    }
    if (data.OPEN_ISSUES) {
        console.log("Opening GitHub issues...");
        Pebble.openURL(ISSUES_URL);
    }
    if (data.NEW_CHAT) {
        console.log("Starting a new conversation...");
        history.clear();
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
        console.log("WARNING: Running Bobby on Cobble is not supported, and has multiple known issues.");
        Pebble.sendAppMessage({COBBLE_WARNING: 1});
    }
}

Pebble.addEventListener("ready",
    function(e) {
        // This happens before anything else because I don't trust Cobble to get through the normal flow,
        // given how many things bizarrely don't work.
        doCobbleWarning();
        console.log("Bobby " + package_json['version']);
        if (Pebble.platform === 'pypkjs') {
            console.log("Entering emulator mode.");
            var emulator_main = require('./emulator/emulator_main');
            emulator_main.main();
            return;
        }
        Pebble.getTimelineToken(function(token) {
            console.log("Entering real mode.");
            session.userToken = token;
            main();
        }, function(e) {
            console.log("Get timeline token failed???", e);
            // Reminders need the token, but the local agent does not. Keep going.
            main();
        })
    }
);

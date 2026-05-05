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

/**
 * Telegram client using GramJS for direct MTProto communication.
 * This eliminates the need for a backend server - all Telegram communication
 * happens directly from the phone app.
 */

var session = require('./session');
var messages = require('./messages');

// Client instance
var client = null;
var isConnected = false;
var currentUser = null;

/**
 * Initialize the Telegram client.
 * @returns {Promise<boolean>} True if successfully initialized
 */
function initClient() {
    console.log('[client] initClient called');
    return new Promise(function(resolve, reject) {
        try {
            var storedSession = session.loadSession();
            console.log('[client] Stored session: ' + (storedSession ? 'present (length: ' + storedSession.length + ')' : 'none'));

            if (typeof TelegramClient !== 'undefined') {
                console.log('[client] GramJS available, creating TelegramClient...');
                var stringSession = new StringSession(storedSession || '');
                client = new TelegramClient(stringSession, process.env.TELEGRAM_APP_ID || 0, process.env.TELEGRAM_APP_HASH || '', {
                    connectionRetries: 5,
                    deviceModel: 'Clawd',
                    systemVersion: '1.0',
                    appVersion: '1.0',
                });

                client.connect().then(function() {
                    isConnected = true;
                    console.log('[client] Telegram client connected successfully');
                    resolve(true);
                }).catch(function(err) {
                    console.error('[client] Failed to connect to Telegram: ' + (err.message || err));
                    reject(err);
                });
            } else {
                console.log('[client] GramJS not loaded, checking for stored session...');
                if (storedSession) {
                    console.log('[client] Using stored session (GramJS unavailable)');
                    isConnected = true;
                    resolve(true);
                } else {
                    console.error('[client] No session available and GramJS not loaded');
                    reject(new Error('No Telegram session available'));
                }
            }
        } catch (err) {
            console.error('[client] Error initializing Telegram client: ' + (err.message || err));
            reject(err);
        }
    });
}

/**
 * Check if client is connected.
 * @returns {boolean}
 */
function isClientConnected() {
    return isConnected && client !== null;
}

/**
 * Get current user info.
 * @returns {object|null}
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Disconnect from Telegram.
 * @returns {Promise<void>}
 */
function disconnect() {
    console.log('[client] disconnect called, client: ' + (client ? 'present' : 'null'));
    return new Promise(function(resolve, reject) {
        if (client) {
            client.disconnect().then(function() {
                console.log('[client] Disconnected successfully');
                isConnected = false;
                client = null;
                currentUser = null;
                session.clearSession();
                resolve();
            }).catch(function(err) {
                console.error('[client] Disconnect failed: ' + (err.message || err));
                reject(err);
            });
        } else {
            console.log('[client] No client to disconnect, clearing session');
            isConnected = false;
            session.clearSession();
            resolve();
        }
    });
}

/**
 * Get the client instance.
 * @returns {object|null}
 */
function getClient() {
    if (!client) {
        console.log('[client] getClient called but client is null');
    }
    return client;
}

// For GramJS compatibility, export these
exports.StringSession = typeof StringSession !== 'undefined' ? StringSession : function(sessionStr) {
    this.sessionStr = sessionStr || '';
    this.save = function() {
        return this.sessionStr;
    };
};

exports.initClient = initClient;
exports.isClientConnected = isClientConnected;
exports.getCurrentUser = getCurrentUser;
exports.disconnect = disconnect;
exports.getClient = getClient;
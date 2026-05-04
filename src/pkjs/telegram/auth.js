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
 * Telegram authentication functions.
 * Handles phone number verification and session management.
 */

var client = require('./client');
var session = require('./session');

// Authentication state
var authState = {
    phoneNumber: null,
    phoneCodeHash: null,
    isWaitingForCode: false
};

/**
 * Start the phone number authentication flow.
 * @param {string} phoneNumber - Phone number in international format (e.g., +1234567890)
 * @returns {Promise<object>} Result with success status and next step
 */
function sendCode(phoneNumber) {
    console.log('[auth] sendCode called for phone: ' + phoneNumber);
    return new Promise(function(resolve, reject) {
        authState.phoneNumber = phoneNumber;

        if (client.getClient()) {
            console.log('[auth] GramJS client available, sending code...');
            client.getClient().sendCode(phoneNumber).then(function(result) {
                console.log('[auth] Code sent successfully, phoneCodeHash: ' + (result.phoneCodeHash ? 'received' : 'missing'));
                authState.phoneCodeHash = result.phoneCodeHash;
                authState.isWaitingForCode = true;
                resolve({
                    success: true,
                    status: 'code_sent',
                    message: 'Verification code sent to ' + phoneNumber
                });
            }).catch(function(err) {
                console.error('[auth] Failed to send code: ' + err.message);
                reject(new Error('Failed to send code: ' + err.message));
            });
        } else {
            console.error('[auth] Cannot send code: GramJS client not initialized');
            reject(new Error('Telegram client not initialized. Please ensure GramJS is loaded.'));
        }
    });
}

/**
 * Sign in with the verification code.
 * @param {string} code - The verification code received via SMS/Telegram
 * @returns {Promise<object>} Result with success status
 */
function signIn(code) {
    console.log('[auth] signIn called with code (length: ' + (code ? code.length : 0) + '), waitingForCode: ' + authState.isWaitingForCode);
    return new Promise(function(resolve, reject) {
        if (!authState.isWaitingForCode) {
            console.error('[auth] signIn rejected: no pending authentication (call sendCode first)');
            reject(new Error('No pending authentication. Call sendCode first.'));
            return;
        }

        if (client.getClient()) {
            console.log('[auth] GramJS client available, attempting sign in...');
            client.getClient().signIn({
                code: code,
                phoneNumber: authState.phoneNumber,
                phoneCodeHash: authState.phoneCodeHash
            }).then(function(user) {
                console.log('[auth] Sign in successful, user: ' + (user.firstName || 'unknown') + ' (id: ' + user.id + ')');
                var sessionStr = client.getClient().session.save();
                session.saveSession(sessionStr);

                authState.isWaitingForCode = false;
                authState.phoneCodeHash = null;

                resolve({
                    success: true,
                    status: 'signed_in',
                    user: {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        username: user.username
                    }
                });
            }).catch(function(err) {
                if (err.message && err.message.includes('SESSION_PASSWORD_NEEDED')) {
                    console.log('[auth] 2FA required for user');
                    resolve({
                        success: false,
                        status: '2fa_required',
                        message: 'Two-factor authentication is enabled. Please provide your password.'
                    });
                } else {
                    console.error('[auth] Failed to sign in: ' + err.message);
                    reject(new Error('Failed to sign in: ' + err.message));
                }
            });
        } else {
            console.error('[auth] Cannot sign in: GramJS client not initialized');
            reject(new Error('Telegram client not initialized.'));
        }
    });
}

/**
 * Complete 2FA authentication.
 * @param {string} password - The 2FA password
 * @returns {Promise<object>} Result with success status
 */
function signInWithPassword(password) {
    console.log('[auth] signInWithPassword called');
    return new Promise(function(resolve, reject) {
        if (!client.getClient()) {
            console.error('[auth] Cannot sign in with password: client not initialized');
            reject(new Error('Telegram client not initialized.'));
            return;
        }

        client.getClient().signInPassword(password).then(function(user) {
            console.log('[auth] 2FA sign in successful, user: ' + (user.firstName || 'unknown') + ' (id: ' + user.id + ')');
            var sessionStr = client.getClient().session.save();
            session.saveSession(sessionStr);

            resolve({
                success: true,
                status: 'signed_in',
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    username: user.username
                }
            });
        }).catch(function(err) {
            console.error('[auth] 2FA sign in failed: ' + err.message);
            reject(new Error('Failed to sign in: ' + err.message));
        });
    });
}

/**
 * Check if there's an existing session.
 * @returns {Promise<object>} Connection status
 */
function checkConnection() {
    console.log('[auth] checkConnection called');
    return new Promise(function(resolve) {
        var storedSession = session.loadSession();
        if (storedSession) {
            console.log('[auth] Stored session found, attempting to connect...');
            client.initClient().then(function() {
                console.log('[auth] Connected successfully with stored session');
                resolve({
                    connected: true,
                    hasSession: true
                });
            }).catch(function(err) {
                console.error('[auth] Failed to connect with stored session: ' + (err.message || err));
                resolve({
                    connected: false,
                    hasSession: true,
                    needsReauth: true
                });
            });
        } else {
            console.log('[auth] No stored session found');
            resolve({
                connected: false,
                hasSession: false
            });
        }
    });
}

/**
 * Disconnect and clear session.
 * @returns {Promise<void>}
 */
function logout() {
    console.log('[auth] logout called');
    return new Promise(function(resolve, reject) {
        client.disconnect().then(function() {
            console.log('[auth] Disconnected and session cleared');
            authState = {
                phoneNumber: null,
                phoneCodeHash: null,
                isWaitingForCode: false
            };
            resolve();
        }).catch(function(err) {
            console.error('[auth] Logout failed: ' + (err.message || err));
            reject(err);
        });
    });
}

/**
 * Get authentication state.
 * @returns {object}
 */
function getAuthState() {
    return {
        phoneNumber: authState.phoneNumber,
        isWaitingForCode: authState.isWaitingForCode
    };
}

exports.sendCode = sendCode;
exports.signIn = signIn;
exports.signInWithPassword = signInWithPassword;
exports.checkConnection = checkConnection;
exports.logout = logout;
exports.getAuthState = getAuthState;
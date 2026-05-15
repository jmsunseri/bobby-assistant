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
 * Uses GramJS's client.start() for the entire auth flow,
 * which handles DC migration, phoneCodeHash management,
 * 2FA, and sign-up automatically.
 */

var client = require('./client');
var session = require('./session');

var codeResolve = null;
var codeReject = null;
var passwordResolve = null;
var passwordReject = null;
var startAuthPromise = null;

function startAuth(phoneNumber) {
    console.log('[auth] startAuth called for phone: ' + phoneNumber);
    return new Promise(function(resolve, reject) {
        var gramjsClient = client.getClient();
        if (!gramjsClient) {
            console.error('[auth] Cannot start auth: GramJS client not initialized');
            reject(new Error('Telegram client not initialized.'));
            return;
        }

        if (startAuthPromise) {
            console.log('[auth] Auth already in progress, rejecting duplicate');
            reject(new Error('Auth already in progress. Wait for it to complete.'));
            return;
        }

        codeResolve = null;
        codeReject = null;
        passwordResolve = null;
        passwordReject = null;

        startAuthPromise = gramjsClient.start({
            phoneNumber: phoneNumber,
            phoneCode: function(isCodeViaApp) {
                console.log('[auth] phoneCode callback triggered (isCodeViaApp: ' + isCodeViaApp + '), waiting for code from watch...');
                return new Promise(function(resolveCode, rejectCode) {
                    codeResolve = resolveCode;
                    codeReject = rejectCode;
                });
            },
            password: function(hint) {
                console.log('[auth] password callback triggered (hint: ' + (hint || 'none') + '), waiting for password from watch...');
                return new Promise(function(resolvePassword, rejectPassword) {
                    passwordResolve = resolvePassword;
                    passwordReject = rejectPassword;
                });
            },
            onError: function(err) {
                console.error('[auth] client.start onError: ' + err.message);
                if (codeReject) { codeReject(err); codeResolve = null; codeReject = null; }
                if (passwordReject) { passwordReject(err); passwordResolve = null; passwordReject = null; }
            }
        }).then(function() {
            console.log('[auth] client.start completed successfully');
            var sessionStr = gramjsClient.session.save();
            session.saveSession(sessionStr);
            startAuthPromise = null;
            codeResolve = null;
            codeReject = null;
            passwordResolve = null;
            passwordReject = null;
            resolve({
                success: true,
                status: 'signed_in'
            });
        }).catch(function(err) {
            console.error('[auth] client.start failed: ' + err.message);
            console.error('[auth] Error stack: ' + (err.stack || 'no stack'));
            startAuthPromise = null;
            codeResolve = null;
            codeReject = null;
            passwordResolve = null;
            passwordReject = null;
            reject(new Error('Auth failed: ' + err.message));
        });
    });
}

function provideCode(code) {
    console.log('[auth] provideCode called (length: ' + (code ? code.length : 0) + ')');
    if (codeResolve) {
        codeResolve(code);
        codeResolve = null;
        codeReject = null;
        return true;
    }
    console.error('[auth] No pending code request — call startAuth first');
    return false;
}

function providePassword(password) {
    console.log('[auth] providePassword called');
    if (passwordResolve) {
        passwordResolve(password);
        passwordResolve = null;
        passwordReject = null;
        return true;
    }
    console.error('[auth] No pending password request');
    return false;
}

function checkConnection() {
    console.log('[auth] checkConnection called');
    return new Promise(function(resolve) {
        var storedSession = session.loadSession();
        if (storedSession) {
            console.log('[auth] Stored session found, attempting to connect...');
            client.initClient().then(function() {
                console.log('[auth] Connected successfully with stored session');
                resolve({ connected: true, hasSession: true });
            }).catch(function(err) {
                console.error('[auth] Failed to connect with stored session: ' + (err.message || err));
                resolve({ connected: false, hasSession: true, needsReauth: true });
            });
        } else {
            console.log('[auth] No stored session found');
            resolve({ connected: false, hasSession: false });
        }
    });
}

function logout() {
    console.log('[auth] logout called');
    return new Promise(function(resolve, reject) {
        client.disconnect().then(function() {
            console.log('[auth] Disconnected and session cleared');
            codeResolve = null;
            codeReject = null;
            passwordResolve = null;
            passwordReject = null;
            startAuthPromise = null;
            resolve();
        }).catch(function(err) {
            console.error('[auth] Logout failed: ' + (err.message || err));
            reject(err);
        });
    });
}

function getAuthState() {
    return {
        isWaitingForCode: codeResolve !== null,
        isWaitingForPassword: passwordResolve !== null,
        isAuthInProgress: startAuthPromise !== null
    };
}

exports.startAuth = startAuth;
exports.provideCode = provideCode;
exports.providePassword = providePassword;
exports.checkConnection = checkConnection;
exports.logout = logout;
exports.getAuthState = getAuthState;
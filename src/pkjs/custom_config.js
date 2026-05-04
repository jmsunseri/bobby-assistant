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

module.exports = function(minified) {
    var clayConfig = this;

    var telegramStatusText, phoneInput, codeInput, botInput;
    var resendCodeBtn, disconnectBtn, pendingActionInput;

    var SESSION_KEY = 'telegram_session';
    var BOT_USERNAME_KEY = 'openclaw_bot_username';
    var AUTH_STATE_KEY = 'clay_telegram_auth_state';

    var pendingAction = null;

    var telegram = require('./telegram');
    var bundleLoader = require('./lib/bundle_loader');
    var indexModule = require('./index');

    function setStatus(text, isError) {
        if (telegramStatusText) {
            telegramStatusText.set(text);
            if (isError) {
                telegramStatusText.$element[0].style.color = 'red';
            } else {
                telegramStatusText.$element[0].style.color = '';
            }
        }
    }

    function loadSession() {
        try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    }

    function clearSession() {
        try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    }

    function getAuthState() {
        try { return JSON.parse(localStorage.getItem(AUTH_STATE_KEY)) || {}; } catch (e) { return {}; }
    }

    function setAuthState(state) {
        try { localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function clearAuthState() {
        try { localStorage.removeItem(AUTH_STATE_KEY); } catch (e) {}
    }

    function getBotUsername() {
        var username = localStorage.getItem(BOT_USERNAME_KEY);
        if (!username) {
            var settings = JSON.parse(localStorage.getItem('clay-settings')) || {};
            username = settings.OPENCLAW_BOT || '@OpenClawBot';
        }
        if (username && !username.startsWith('@')) { username = '@' + username; }
        return username || '@OpenClawBot';
    }

    function saveBotUsername(username) {
        try {
            if (username && !username.startsWith('@')) { username = '@' + username; }
            localStorage.setItem(BOT_USERNAME_KEY, username);
        } catch (e) {}
    }

    function setPendingAction(action) {
        console.log('[config] setPendingAction: ' + JSON.stringify(action));
        pendingAction = action;
        if (pendingActionInput) {
            pendingActionInput.set(JSON.stringify(action));
        }
    }

    function updateUI() {
        var session = loadSession();
        var authState = getAuthState();

        console.log('[config] updateUI: session=' + (session ? 'present' : 'none') +
            ', waitingForCode=' + !!authState.waitingForCode +
            ', needs2FA=' + !!authState.needs2FA);

        if (pendingActionInput) { pendingActionInput.hide(); }

        if (session) {
            setStatus('Connected (' + getBotUsername() + ')');
            if (phoneInput) phoneInput.hide();
            if (codeInput) codeInput.hide();
            if (resendCodeBtn) resendCodeBtn.hide();
            if (disconnectBtn) disconnectBtn.show();
            if (botInput) botInput.show();
        } else if (authState.waitingForCode) {
            setStatus('A verification code was sent to ' + (authState.phoneNumber || 'your phone') + '. Enter the code below and press Save.');
            console.log('[config] UI state: waiting for code, phone: ' + (authState.phoneNumber || 'unknown'));
            if (phoneInput) phoneInput.hide();
            if (codeInput) codeInput.show();
            if (resendCodeBtn) resendCodeBtn.show();
            if (disconnectBtn) disconnectBtn.hide();
            if (botInput) botInput.show();
        } else {
            setStatus('Not connected. Enter your phone number and save to send a verification code.');
            console.log('[config] UI state: not connected');
            if (phoneInput) {
                phoneInput.show();
                var phone = phoneInput.get();
                if (phone) {
                    console.log('[config] Auto-setting send_code action with existing phone number');
                    setPendingAction({ action: 'send_code', phoneNumber: normalizePhone(phone) });
                }
            }
            if (codeInput) codeInput.hide();
            if (resendCodeBtn) resendCodeBtn.hide();
            if (disconnectBtn) disconnectBtn.hide();
            if (botInput) botInput.show();
        }
    }

    function normalizePhone(phone) {
        phone = phone.replace(/[\s\-\(\)]/g, '');
        if (!phone.startsWith('+')) { phone = '+' + phone; }
        return phone;
    }

    clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function() {
        telegramStatusText = clayConfig.getItemById('telegramStatus');
        phoneInput = clayConfig.getItemByMessageKey('TELEGRAM_PHONE');
        codeInput = clayConfig.getItemByMessageKey('TELEGRAM_CODE');
        botInput = clayConfig.getItemByMessageKey('OPENCLAW_BOT');
        resendCodeBtn = clayConfig.getItemByMessageKey('TELEGRAM_SEND_CODE');
        disconnectBtn = clayConfig.getItemByMessageKey('TELEGRAM_DISCONNECT');
        pendingActionInput = clayConfig.getItemByMessageKey('TELEGRAM_PENDING_ACTION');

        updateUI();

        clayConfig.on(clayConfig.EVENTS.AFTER_DESTROY, function() {
            if (!pendingAction) {
                console.log('[config] No pending action to execute on save');
                return;
            }

            var action = pendingAction;
            pendingAction = null;

            console.log('[config] Executing pending action on save: ' + JSON.stringify(action));

            bundleLoader.ensureTelegramBundle();

            if (action.action === 'send_code' && action.phoneNumber) {
                console.log('[config] Sending verification code to: ' + action.phoneNumber);
                telegram.sendCode(action.phoneNumber).then(function(result) {
                    console.log('[config] Code sent successfully');
                    setAuthState({
                        waitingForCode: true,
                        phoneNumber: action.phoneNumber
                    });
                    if (indexModule.updateTelegramStatus) { indexModule.updateTelegramStatus(); }
                }).catch(function(err) {
                    console.error('[config] Failed to send code: ' + err.message);
                });
            } else if (action.action === 'sign_in' && action.code) {
                console.log('[config] Signing in with code');
                telegram.signIn(action.code).then(function(result) {
                    console.log('[config] Sign in result: ' + JSON.stringify(result));
                    if (result.status === '2fa_required') {
                        console.log('[config] 2FA required');
                        setAuthState({
                            waitingForCode: false,
                            needs2FA: true,
                            phoneNumber: telegram.getAuthState().phoneNumber
                        });
                    } else {
                        clearAuthState();
                    }
                    if (indexModule.updateTelegramStatus) { indexModule.updateTelegramStatus(); }
                }).catch(function(err) {
                    console.error('[config] Failed to sign in: ' + err.message);
                });
            } else if (action.action === 'disconnect') {
                console.log('[config] Disconnecting from Telegram');
                telegram.logout().then(function() {
                    console.log('[config] Disconnected successfully');
                    clearAuthState();
                    if (indexModule.updateTelegramStatus) { indexModule.updateTelegramStatus(); }
                }).catch(function(err) {
                    console.error('[config] Failed to disconnect: ' + err.message);
                });
            }
        });

        if (resendCodeBtn) {
            resendCodeBtn.on('click', function() {
                var authState = getAuthState();
                var phoneNumber = authState.phoneNumber || (phoneInput ? phoneInput.get() : '');
                console.log('[config] Resend code clicked, phone: ' + (phoneNumber ? '****' + phoneNumber.slice(-4) : '(empty)'));
                if (!phoneNumber) {
                    setStatus('Please enter a phone number', true);
                    return;
                }
                phoneNumber = normalizePhone(phoneNumber);
                setPendingAction({ action: 'send_code', phoneNumber: phoneNumber });
                setStatus('Save to resend the verification code.');
            });
        }

        if (disconnectBtn) {
            disconnectBtn.on('click', function() {
                console.log('[config] Disconnect button clicked');
                clearSession();
                clearAuthState();
                setPendingAction({ action: 'disconnect' });
                updateUI();
            });
        }

        if (botInput) {
            botInput.on('change', function() {
                var username = botInput.get();
                if (username) { saveBotUsername(username); }
            });
        }

        if (phoneInput) {
            phoneInput.on('change', function() {
                var phone = phoneInput.get();
                console.log('[config] Phone number changed: ' + (phone ? '****' + phone.slice(-4) : '(cleared)'));
                if (phone) {
                    setPendingAction({ action: 'send_code', phoneNumber: normalizePhone(phone) });
                }
            });
        }

        if (codeInput) {
            codeInput.on('change', function() {
                var code = codeInput.get();
                console.log('[config] Verification code changed (length: ' + (code ? code.length : 0) + ')');
                if (code) {
                    setPendingAction({ action: 'sign_in', code: code });
                }
            });
        }
    });
};
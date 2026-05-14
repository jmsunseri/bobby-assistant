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
    var haveCodeBtn, resendCodeBtn, disconnectBtn, pendingActionInput;

    var SESSION_KEY = 'telegram_session';
    var BOT_USERNAME_KEY = 'openclaw_bot_username';

    var showingCodeEntry = false;

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

    function getBotUsername() {
        var username = localStorage.getItem(BOT_USERNAME_KEY);
        try {
            var settings = JSON.parse(localStorage.getItem('clay-settings')) || {};
            if (!username) { username = settings.OPENCLAW_BOT || '@OpenClawBot'; }
        } catch (e) {
            if (!username) { username = '@OpenClawBot'; }
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
        if (pendingActionInput) {
            pendingActionInput.set(JSON.stringify(action));
        }
    }

    function showCodeEntry() {
        showingCodeEntry = true;
        setStatus('Enter the verification code sent to your phone, then press Save.');
        if (phoneInput) phoneInput.hide();
        if (codeInput) codeInput.show();
        if (haveCodeBtn) haveCodeBtn.hide();
        if (resendCodeBtn) resendCodeBtn.show();
        if (disconnectBtn) disconnectBtn.hide();
        if (botInput) botInput.hide();
        if (codeInput) {
            try { codeInput.$element[0].querySelector('input').focus(); } catch (e) {}
        }
    }

    function updateUI() {
        if (pendingActionInput) { pendingActionInput.hide(); }

        var session = loadSession();
        if (session) {
            setStatus('Connected (' + getBotUsername() + ')');
            if (phoneInput) phoneInput.hide();
            if (codeInput) codeInput.hide();
            if (haveCodeBtn) haveCodeBtn.hide();
            if (resendCodeBtn) resendCodeBtn.hide();
            if (disconnectBtn) disconnectBtn.show();
            if (botInput) botInput.show();
        } else if (showingCodeEntry) {
            showCodeEntry();
        } else {
            setStatus('Not connected. Enter your phone number and save to send a verification code.');
            if (phoneInput) phoneInput.show();
            if (codeInput) codeInput.hide();
            if (haveCodeBtn) haveCodeBtn.show();
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
        haveCodeBtn = clayConfig.getItemByMessageKey('TELEGRAM_HAVE_CODE');
        resendCodeBtn = clayConfig.getItemByMessageKey('TELEGRAM_SEND_CODE');
        disconnectBtn = clayConfig.getItemByMessageKey('TELEGRAM_DISCONNECT');
        pendingActionInput = clayConfig.getItemByMessageKey('TELEGRAM_PENDING_ACTION');

        updateUI();

        if (haveCodeBtn) {
            haveCodeBtn.on('click', function() {
                console.log('[config] "I have a code" clicked — showing code entry');
                showCodeEntry();
            });
        }

        if (resendCodeBtn) {
            resendCodeBtn.on('click', function() {
                var phone = phoneInput ? phoneInput.get() : '';
                console.log('[config] Resend code clicked, phone: ' + (phone ? '****' + phone.slice(-4) : '(empty)'));
                if (!phone) {
                    setStatus('No phone number on file. Go back and enter one.', true);
                    return;
                }
                setPendingAction({ action: 'send_code', phoneNumber: normalizePhone(phone) });
                setStatus('Save to resend the verification code.');
            });
        }

        if (disconnectBtn) {
            disconnectBtn.on('click', function() {
                console.log('[config] Disconnect button clicked');
                clearSession();
                showingCodeEntry = false;
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

        if (codeInput) {
            codeInput.on('change', function() {
                var code = codeInput.get();
                if (code) {
                    setPendingAction({ action: 'sign_in', code: code });
                }
            });
        }
    });
};
import { describe, it, expect, beforeAll, vi } from 'vitest';
import 'dotenv/config';

describe('Telegram bundle globals', () => {
    it('should expose TelegramClient, StringSession, and TelegramApi after loading bundle', () => {
        const bundleLoader = require('../src/pkjs/lib/bundle_loader.js');
        bundleLoader.ensureTelegramBundle();

        expect(typeof TelegramClient).toBe('function');
        expect(typeof StringSession).toBe('function');
        expect(typeof TelegramApi).toBe('object');
        expect(typeof TelegramApi.auth).toBe('object');
        expect(typeof TelegramApi.auth.SignIn).toBe('function');
        expect(typeof TelegramApi.auth.SendCode).toBe('function');
    });

    it('should construct TelegramApi.auth.SignIn request objects', () => {
        const signInRequest = new TelegramApi.auth.SignIn({
            phoneNumber: '+15551234567',
            phoneCodeHash: 'fakehash',
            phoneCode: '12345'
        });
        expect(signInRequest).toBeDefined();
        expect(signInRequest.className).toBe('auth.SignIn');
    });
});

describe('Telegram auth module (without real API)', () => {
    let auth;

    beforeAll(() => {
        auth = require('../src/pkjs/telegram/auth.js');
    });

    it('should return getAuthState with no pending requests initially', () => {
        const state = auth.getAuthState();
        expect(state.isWaitingForCode).toBe(false);
        expect(state.isWaitingForPassword).toBe(false);
        expect(state.isAuthInProgress).toBeFalsy();
    });

    it('should return false from provideCode when no auth in progress', () => {
        const result = auth.provideCode('12345');
        expect(result).toBe(false);
    });
});

describe('Telegram auth with real API', () => {
    it('should connect, start auth, and reach phoneCode callback', async () => {
        const phone = process.env.TELEGRAM_PHONE;
        if (!phone || phone === '+15551234567') {
            throw new Error('Set your real TELEGRAM_PHONE in .env');
        }

        const bundleLoader = require('../src/pkjs/lib/bundle_loader.js');
        bundleLoader.ensureTelegramBundle();

        const client = require('../src/pkjs/telegram/client.js');
        const auth = require('../src/pkjs/telegram/auth.js');

        const connected = await client.initClient();
        expect(connected).toBe(true);

        // startAuth will block on the phoneCode callback until provideCode() is called
        const startAuthPromise = auth.startAuth(phone);

        // Wait for DC migration + code sending + phoneCode callback
        await new Promise(resolve => setTimeout(resolve, 10000));

        // After the phoneCode callback fires, isWaitingForCode should be true
        const state = auth.getAuthState();
        expect(state.isWaitingForCode).toBe(true);
        expect(state.isAuthInProgress).toBeTruthy();

        // Cancel: reject the code promise so client.start() can finish
        // This triggers onError which cleans up state
        auth.provideCode('00000'); // invalid code to trigger error and end the flow

        // Give it time to process the error
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Disconnect the client
        try {
            await client.disconnect();
        } catch (e) {
            // May already be disconnected
        }
    }, 60000);
});
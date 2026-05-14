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

    it('should reject signIn when no sendCode was called first', async () => {
        const telegram = require('../src/pkjs/telegram/index.js');
        // Reset auth state by requiring fresh module
        await expect(telegram.signIn('12345')).rejects.toThrow('No pending authentication');
    });
});

describe('Telegram auth with real API', () => {
    it('should send a verification code to a real phone number', async () => {
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

        const result = await auth.sendCode(phone);
        expect(result.success).toBe(true);
        expect(result.status).toBe('code_sent');

        // phoneCodeHash is stored internally in authState, not returned
        console.log('sendCode succeeded. Not attempting signIn (requires real code).');
    }, 60000);
});
import { describe, it, expect } from 'vitest';
import 'dotenv/config';

describe('Telegram auth with real API', () => {
    it('should send auth code to phone', async () => {
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

        auth.startAuth(phone);

        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
            const state = auth.getAuthState();
            if (state.isWaitingForCode) break;
            await new Promise(r => setTimeout(r, 500));
        }

        const state = auth.getAuthState();
        expect(state.isWaitingForCode).toBe(true);

        try { await client.disconnect(); } catch (e) {}
    }, 60000);
});
import { describe, it, expect } from 'vitest';
import 'dotenv/config';

import { handleAppMessage } from '../src/pkjs/index.js';

describe.skip('handleAppMessage - real telegram start_auth', () => {
  it('should connect to Telegram and reach phoneCode callback via start_auth', async () => {
    const phone = process.env.TELEGRAM_PHONE;
    if (!phone || phone === '+15551234567') {
      throw new Error('Set your real TELEGRAM_PHONE in .env');
    }

    const payload = {
      TELEGRAM_PENDING_ACTION: JSON.stringify({ action: 'start_auth', phoneNumber: phone }),
    };

    handleAppMessage({ payload });

    const auth = require('../src/pkjs/telegram/auth.js');

    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const state = auth.getAuthState();
      if (state.isWaitingForCode) break;
      await new Promise(r => setTimeout(r, 500));
    }

    const state = auth.getAuthState();
    expect(state.isWaitingForCode).toBe(true);
    expect(state.isCodeViaApp).not.toBeNull();

    const client = require('../src/pkjs/telegram/client.js');
    try { await client.disconnect(); } catch (e) {}
  }, 60000);
});
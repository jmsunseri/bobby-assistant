import { describe, it, expect, vi, beforeAll } from 'vitest';
import 'dotenv/config';

import { handleAppMessage } from '../src/pkjs/index.js';

describe('handleAppMessage - real telegram start_auth', () => {
  it('should connect to Telegram and reach phoneCode callback via start_auth', async () => {
    const phone = process.env.TELEGRAM_PHONE;
    if (!phone || phone === '+15551234567') {
      throw new Error('Set your real TELEGRAM_PHONE in .env');
    }

    const payload = {
      TELEGRAM_PENDING_ACTION: JSON.stringify({ action: 'start_auth', phoneNumber: phone }),
    };

    handleAppMessage({ payload });

    // Wait for connect + DC migration + code sending + phoneCode callback
    await new Promise((resolve) => setTimeout(resolve, 15000));

    // The auth module should be waiting for a code
    const auth = require('../src/pkjs/telegram/auth.js');
    const state = auth.getAuthState();
    expect(state.isWaitingForCode).toBe(true);
  }, 60000);
});
import { describe, it, expect, vi, beforeAll } from 'vitest';
import 'dotenv/config';

import { handleAppMessage } from '../src/pkjs/index.js';

describe('handleAppMessage - real telegram send_code', () => {
  it('should connect to Telegram and attempt to send verification code', async () => {
    const phone = process.env.TELEGRAM_PHONE;
    if (!phone || phone === '+15551234567') {
      throw new Error('Set your real TELEGRAM_PHONE in .env');
    }

    const payload = {
      TELEGRAM_PENDING_ACTION: JSON.stringify({ action: 'send_code', phoneNumber: phone }),
    };

    handleAppMessage({ payload });

    await new Promise((resolve) => setTimeout(resolve, 30000));

    expect(global.Pebble.sendAppMessage).toHaveBeenCalled();
  }, 60000);
});
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import engine from '../app/src/pkjs/agent/engine.js';

class MemoryStorage {
  constructor() { this.data = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
  setItem(key, value) { this.data[key] = String(value); }
  removeItem(key) { delete this.data[key]; }
}

class FakeXHR {
  constructor() {
    this.status = 0;
    this.responseText = '';
    this.timeout = 0;
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  send(body) {
    const response = global.__fakeXHR(this.method, this.url, body);
    this.status = response.status || 200;
    this.responseText = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    if (this.onload) {
      this.onload();
    }
  }
  abort() {}
}

function textOf(frames) {
  return frames
    .filter((f) => f[0] === 'c' && f.indexOf('<<!!WIDGET:') === -1)
    .map((f) => f.slice(1))
    .join('');
}

function turn(prompt) {
  return new Promise((resolve) => {
    const frames = [];
    engine.runTurn({
      prompt,
      threadId: null,
      session: { enqueue() {} },
      emit(frame) { frames.push(frame); },
      done() { resolve(frames); }
    });
  });
}

function clefAnswer(choice, probabilities, synthesis) {
  return {
    body: {
      success: true,
      result: {
        model: 'clef-flash',
        answers: {
          tool: {
            type: 'choice',
            choice,
            probabilities,
            confidence: probabilities[choice] || 0.9
          },
          needs_synthesis: { type: 'noul', noul: synthesis || 0 }
        }
      }
    }
  };
}

beforeEach(() => {
  global.localStorage = new MemoryStorage();
  global.localStorage.setItem('clay-settings', JSON.stringify({
    CF_ACCOUNT_ID: 'account',
    CF_API_TOKEN: 'token',
    CF_PAID_PLAN: true
  }));
  global.XMLHttpRequest = FakeXHR;
});

afterEach(() => {
  delete global.__fakeXHR;
  delete global.XMLHttpRequest;
});

describe('agent fast path', () => {
  it('answers a time question without an LLM reply', async () => {
    global.__fakeXHR = (method, url) => {
      if (url.indexOf('clef-flash') !== -1) {
        return clefAnswer('time', { time: 0.95, chat: 0.02 });
      }
      throw new Error('unexpected request ' + url);
    };
    const frames = await turn('what time is it?');
    expect(frames[0].startsWith('t')).toBe(true);
    expect(textOf(frames)).toContain('It\'s');
    expect(frames[frames.length - 1]).toBe('d');
  });

  it('runs weather and emits a weather widget', async () => {
    global.__fakeXHR = (method, url, body) => {
      if (url.indexOf('clef-flash') !== -1) {
        return clefAnswer('weather', { weather: 0.93, chat: 0.03 });
      }
      if (url.indexOf('clairic') !== -1) {
        return {
          body: {
            success: true,
            result: {
              model: 'clairic',
              answers: {
                location: { type: 'text', value: 'Paris', p_null: 0.01, confidence: 0.99 },
                when: { type: 'text', value: 'tomorrow', p_null: 0.05, confidence: 0.95 }
              }
            }
          }
        };
      }
      if (url.indexOf('geocoding-api') !== -1) {
        return { body: { results: [{ name: 'Paris', latitude: 48.85, longitude: 2.35 }] } };
      }
      if (url.indexOf('api.open-meteo.com') !== -1) {
        return {
          body: {
            current: { temperature_2m: 12, apparent_temperature: 10, weather_code: 2, wind_speed_10m: 14 },
            daily: {
              time: ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'],
              weather_code: [2, 61, 0, 3],
              temperature_2m_max: [15, 12, 16, 14],
              temperature_2m_min: [7, 8, 6, 7]
            }
          }
        };
      }
      throw new Error('unexpected request ' + url);
    };

    const frames = await turn('what is the weather in Paris tomorrow?');
    const widget = frames.find((f) => f.indexOf('<<!!WIDGET:') !== -1);
    expect(widget).toBeTruthy();
    expect(widget).toContain('weather-single-day');
    expect(textOf(frames)).toContain('Tomorrow in Paris');
    expect(frames[frames.length - 1]).toBe('d');
  });

  it('asks full Clef before falling back when flash is unsure', async () => {
    let fullCalls = 0;
    global.__fakeXHR = (method, url) => {
      if (url.indexOf('clef-flash') !== -1) {
        return clefAnswer('set_timer', { set_timer: 0.40, chat: 0.30 });
      }
      if (url.indexOf('/ai/run/@cf/cloudflare/clef') !== -1) {
        fullCalls++;
        return clefAnswer('time', { time: 0.95, chat: 0.02 });
      }
      throw new Error('unexpected request ' + url);
    };
    const frames = await turn('what time is it?');
    expect(fullCalls).toBe(1);
    expect(textOf(frames)).toContain('It\'s');
    expect(frames[frames.length - 1]).toBe('d');
  });

  it('does not make a second LLM call after a deterministic tool result', async () => {
    let chatCalls = 0;
    global.__fakeXHR = (method, url) => {
      if (url.indexOf('clef-flash') !== -1) {
        return clefAnswer('set_timer', { set_timer: 0.40, chat: 0.30 });
      }
      if (url.indexOf('/ai/run/@cf/cloudflare/clef') !== -1) {
        return clefAnswer('set_timer', { set_timer: 0.40, chat: 0.30 });
      }
      chatCalls++;
      return {
        body: {
          success: true,
          result: { tool_calls: [{ name: 'time', arguments: {} }] }
        }
      };
    };
    const frames = await turn('what time is it?');
    expect(chatCalls).toBe(1);
    expect(textOf(frames)).toContain('It\'s');
    expect(frames[frames.length - 1]).toBe('d');
  });

  it('falls back to chat when routing is uncertain', async () => {
    global.__fakeXHR = (method, url) => {
      if (url.indexOf('clef-flash') !== -1) {
        return clefAnswer('weather', { weather: 0.5, chat: 0.45 });
      }
      if (url.indexOf('/ai/run/@cf/cloudflare/clef') !== -1) {
        return clefAnswer('chat', { chat: 0.90 });
      }
      return {
        body: {
          success: true,
          result: { response: 'I can help with that.' }
        }
      };
    };
    const frames = await turn('tell me something');
    expect(textOf(frames)).toContain('I can help with that.');
    expect(frames[frames.length - 1]).toBe('d');
  });

  it('warns instead of throwing when credentials are missing', async () => {
    global.localStorage.setItem('clay-settings', JSON.stringify({}));
    global.__fakeXHR = () => {
      throw new Error('should not make a request');
    };
    const frames = await turn('what time is it?');
    expect(frames[0].startsWith('w')).toBe(true);
    expect(frames[frames.length - 1]).toBe('d');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import settings from '../app/src/pkjs/agent/settings.js';

class MemoryStorage {
  constructor() { this.data = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
  setItem(key, value) { this.data[key] = String(value); }
}

beforeEach(() => {
  global.localStorage = new MemoryStorage();
});

function setSettings(values) {
  global.localStorage.setItem('clay-settings', JSON.stringify(values));
}

describe('model selection', () => {
  it('defaults to DeepSeek on a paid plan', () => {
    setSettings({ CF_PAID_PLAN: true });
    expect(settings.getModelId()).toBe('@cf/deepseek-ai/deepseek-v4.1-flash-1017');
  });

  it('defaults to Gemma without a paid plan', () => {
    setSettings({ CF_PAID_PLAN: false });
    expect(settings.getModelId()).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it('downgrades a paid model when the paid toggle is off', () => {
    setSettings({
      CF_PAID_PLAN: false,
      CF_MODEL: '@cf/zai-org/glm-5.3'
    });
    expect(settings.getModelId()).toBe('@cf/google/gemma-4-26b-a4b-it');
  });

  it('keeps an explicit free model', () => {
    setSettings({
      CF_PAID_PLAN: false,
      CF_MODEL: '@cf/qwen/qwen3.8-27b'
    });
    expect(settings.getModelId()).toBe('@cf/qwen/qwen3.8-27b');
  });

  it('falls back from an unknown model', () => {
    setSettings({ CF_PAID_PLAN: true, CF_MODEL: '@cf/retired/model' });
    expect(settings.getModelId()).toBe('@cf/deepseek-ai/deepseek-v4.1-flash-1017');
  });

  it('normalises reasoning effort', () => {
    setSettings({ CF_REASONING_EFFORT: 'wat' });
    expect(settings.getReasoningEffort()).toBe('low');
    setSettings({ CF_REASONING_EFFORT: 'high' });
    expect(settings.getReasoningEffort()).toBe('high');
  });
});

describe('credentials', () => {
  it('trims whitespace from the account and token', () => {
    setSettings({
      CF_ACCOUNT_ID: ' abc ',
      CF_API_TOKEN: ' tok\n'
    });
    const cf = settings.getCloudflare();
    expect(cf.accountId).toBe('abc');
    expect(cf.token).toBe('tok');
    expect(settings.hasCloudflareCredentials()).toBe(true);
  });

  it('reports missing credentials', () => {
    setSettings({});
    expect(settings.hasCloudflareCredentials()).toBe(false);
  });
});

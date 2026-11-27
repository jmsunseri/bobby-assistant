import { describe, it, expect, beforeEach } from 'vitest';
import router from '../app/src/pkjs/agent/router.js';

class MemoryStorage {
  constructor() {
    this.data = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
  }
  setItem(key, value) {
    this.data[key] = String(value);
  }
  removeItem(key) {
    delete this.data[key];
  }
  clear() {
    this.data = {};
  }
}

beforeEach(() => {
  global.localStorage = new MemoryStorage();
});

describe('router thresholds', () => {
  it('takes the fast path for a confident tool with margin', () => {
    const decision = router.chooseKind('weather', { weather: 0.9, chat: 0.05 }, 0.9);
    expect(decision.kind).toBe('tool');
    expect(decision.topProbability).toBeCloseTo(0.9);
  });

  it('falls back to chat when the tool is not confident enough', () => {
    const decision = router.chooseKind('weather', { weather: 0.55, chat: 0.3 }, 0.55);
    expect(decision.kind).toBe('chat');
    expect(decision.reason).toBe('low-confidence');
  });

  it('falls back to chat when chat is close behind', () => {
    const decision = router.chooseKind('weather', { weather: 0.62, chat: 0.5 }, 0.62);
    expect(decision.kind).toBe('chat');
  });

  it('passes through chat and multi choices', () => {
    expect(router.chooseKind('chat', { chat: 0.99 }, 0.99).kind).toBe('chat');
    expect(router.chooseKind('multi', { multi: 0.8 }, 0.8).kind).toBe('multi');
  });

  it('only asks full Clef when flash is unsure about a tool', () => {
    expect(router.shouldAskFullClef({
      kind: 'chat',
      reason: 'low-confidence',
      tool: 'set_timer'
    })).toBe(true);
    expect(router.shouldAskFullClef({
      kind: 'chat',
      reason: 'low-confidence',
      tool: 'chat'
    })).toBe(false);
    expect(router.shouldAskFullClef({
      kind: 'tool',
      reason: 'confident',
      tool: 'set_timer'
    })).toBe(false);
  });
});

describe('clef questions', () => {
  it('asks both routing and synthesis questions', () => {
    const questions = router.buildQuestions({ weather: 'weather', chat: 'chat' });
    expect(questions.tool.type).toBe('choice');
    expect(questions.needs_synthesis.type).toBe('noul');
    expect(Object.keys(questions.tool.criteria)).toContain('chat');
  });
});

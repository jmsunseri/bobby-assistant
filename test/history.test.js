import { describe, it, expect, beforeEach } from 'vitest';
import history from '../app/src/pkjs/agent/history.js';

class MemoryStorage {
  constructor() { this.data = {}; }
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; }
  setItem(key, value) { this.data[key] = String(value); }
  removeItem(key) { delete this.data[key]; }
  clear() { this.data = {}; }
}

beforeEach(() => {
  global.localStorage = new MemoryStorage();
});

describe('conversation history', () => {
  it('creates and keeps one active thread', () => {
    const first = history.begin();
    const second = history.begin();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it('adopts a thread id from the watch', () => {
    const thread = history.begin('watch-thread');
    expect(thread).toBe('watch-thread');
    expect(history.begin('watch-thread')).toBe('watch-thread');
  });

  it('starts fresh when the watch hands over a different thread', () => {
    history.begin('one');
    history.append('user', 'hello');
    const thread = history.begin('two');
    expect(thread).toBe('two');
    expect(history.recentContext()).toBe('');
  });

  it('keeps recent turns for the router', () => {
    history.begin();
    history.append('user', 'weather in Paris?');
    history.append('assistant', 'It is sunny.');
    const context = history.recentContext();
    expect(context).toContain('User: weather in Paris?');
    expect(context).toContain('Assistant: It is sunny.');
  });

  it('clears into a new thread', () => {
    const old = history.begin();
    history.append('user', 'hello');
    const fresh = history.clear();
    expect(fresh).not.toBe(old);
    expect(history.recentContext()).toBe('');
  });

  it('recovers from corrupt storage', () => {
    global.localStorage.setItem(history.STORAGE_KEY, '{not json');
    expect(history.begin()).toBeTruthy();
  });
});

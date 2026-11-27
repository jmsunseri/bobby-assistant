import { describe, it, expect } from 'vitest';
import alarms from '../app/src/pkjs/agent/tools/alarms.js';

describe('timer duration labels', () => {
  it('describes sub-minute timers in seconds', () => {
    expect(alarms.minutesLabel(0.5)).toBe('30 seconds');
    expect(alarms.minutesLabel(0.25)).toBe('15 seconds');
  });

  it('describes mixed minutes and seconds', () => {
    expect(alarms.minutesLabel(1.5)).toBe('1 minute 30 seconds');
    expect(alarms.minutesLabel(10)).toBe('10 minutes');
    expect(alarms.minutesLabel(90)).toBe('1 hour 30 minutes');
  });
});

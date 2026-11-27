import { describe, it, expect } from 'vitest';
import extract from '../app/src/pkjs/agent/extract.js';

describe('extract field policy', () => {
  const tool = {
    fields: {
      duration_minutes: { type: 'number' },
      name: { type: 'text' }
    },
    required: ['duration_minutes']
  };

  it('accepts a confident required field', () => {
    const issues = extract.checkFields(tool, {
      duration_minutes: { value: 10, p_null: 0.001, confidence: 0.99 }
    });
    expect(issues).toHaveLength(0);
  });

  it('flags a missing required field', () => {
    const issues = extract.checkFields(tool, {
      duration_minutes: { value: null, p_null: 0.9, confidence: 0.5 }
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe('missing');
  });

  it('flags an uncertain required field', () => {
    const issues = extract.checkFields(tool, {
      duration_minutes: { value: 10, p_null: 0.2, confidence: 0.7 }
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe('uncertain');
  });

  it('does not require optional fields', () => {
    const issues = extract.checkFields(tool, {
      duration_minutes: { value: 10, p_null: 0.001, confidence: 0.99 },
      name: { value: null, p_null: 1, confidence: 0 }
    });
    expect(issues).toHaveLength(0);
  });

  it('coerces numbers and trims text', () => {
    const args = extract.buildArgs(tool, {
      duration_minutes: { value: '10' },
      name: { value: '  pasta  ' }
    });
    expect(args.duration_minutes).toBe(10);
    expect(args.name).toBe('pasta');
  });

  it('drops null values', () => {
    const args = extract.buildArgs(tool, {
      duration_minutes: { value: 5 },
      name: { value: null }
    });
    expect(args.name).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import weather from '../app/src/pkjs/agent/tools/weather.js';
import templates from '../app/src/pkjs/agent/templates.js';

describe('weather codes', () => {
  it('maps WMO codes to watch conditions', () => {
    expect(weather.conditionName(0)).toBe('SUN');
    expect(weather.conditionName(2)).toBe('PARTLY_CLOUDY');
    expect(weather.conditionName(45)).toBe('CLOUDY_DAY');
    expect(weather.conditionName(61)).toBe('LIGHT_RAIN');
    expect(weather.conditionName(65)).toBe('HEAVY_RAIN');
    expect(weather.conditionName(73)).toBe('LIGHT_SNOW');
    expect(weather.conditionName(95)).toBe('HEAVY_RAIN');
  });

  it('converts temperatures for imperial units', () => {
    expect(weather.temperature(0, 'metric')).toBe(0);
    expect(weather.temperature(0, 'imperial')).toBe(32);
    expect(weather.temperature(20, 'imperial')).toBe(68);
  });

  it('selects today, tomorrow, and weekdays', () => {
    const days = [
      { label: 'Today' },
      { label: 'Tomorrow' },
      { label: 'Wednesday' }
    ];
    expect(weather.findDay(days, 'now').mode).toBe('current');
    expect(weather.findDay(days, 'tomorrow').index).toBe(1);
    expect(weather.findDay(days, 'Wednesday').index).toBe(2);
    expect(weather.findDay(days, 'week').mode).toBe('multi');
  });
});

describe('templates', () => {
  it('formats a currency result with a number widget', () => {
    const reply = templates.forTool('currency', {}, {
      ok: true,
      data: { amount: 10, from: 'USD', to: 'EUR', converted: 9.25 }
    }, {});
    expect(reply.text).toBe('10 USD is 9.25 EUR.');
    expect(reply.widget.type).toBe('number');
    expect(reply.widget.content.unit).toBe('EUR');
  });

  it('formats current weather and a current widget', () => {
    const reply = templates.forTool('weather', {}, {
      ok: true,
      data: {
        location: 'Paris',
        mode: 'current',
        current: {
          temperature: 12,
          feelsLike: 10,
          summary: 'partly cloudy',
          unit: '°C',
          windSpeed: 14,
          windUnit: 'km/h',
          condition: 'PARTLY_CLOUDY'
        },
        days: []
      }
    }, {});
    expect(reply.text).toContain('Paris');
    expect(reply.text).toContain('12°C');
    expect(reply.widget.type).toBe('weather-current');
    expect(reply.widget.content.condition_name).toBe('PARTLY_CLOUDY');
  });

  it('asks a specific clarification question', () => {
    const text = templates.clarification({}, [
      { field: 'duration_minutes', spec: {} }
    ]);
    expect(text).toBe('How long should the timer be?');
  });
});

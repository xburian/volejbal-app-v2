import { describe, it, expect } from 'vitest';
import { generateRecurringDates, RecurrenceConfig } from './recurrence';

describe('generateRecurringDates', () => {
  it('returns single date when recurrence is disabled', () => {
    const config: RecurrenceConfig = { enabled: false, frequency: 'weekly', count: 4 };
    const result = generateRecurringDates('2026-05-13', config);
    expect(result).toEqual(['2026-05-13']);
  });

  it('generates correct weekly dates', () => {
    const config: RecurrenceConfig = { enabled: true, frequency: 'weekly', count: 4 };
    const result = generateRecurringDates('2026-05-13', config);
    expect(result).toEqual([
      '2026-05-13',
      '2026-05-20',
      '2026-05-27',
      '2026-06-03',
    ]);
  });

  it('generates correct biweekly dates', () => {
    const config: RecurrenceConfig = { enabled: true, frequency: 'biweekly', count: 3 };
    const result = generateRecurringDates('2026-05-13', config);
    expect(result).toEqual([
      '2026-05-13',
      '2026-05-27',
      '2026-06-10',
    ]);
  });

  it('caps count at 26', () => {
    const config: RecurrenceConfig = { enabled: true, frequency: 'weekly', count: 50 };
    const result = generateRecurringDates('2026-01-01', config);
    expect(result).toHaveLength(26);
  });

  it('handles count of 1 (returns single date)', () => {
    const config: RecurrenceConfig = { enabled: true, frequency: 'weekly', count: 1 };
    const result = generateRecurringDates('2026-05-13', config);
    expect(result).toEqual(['2026-05-13']);
  });

  it('handles count of 0 (returns single date due to Math.max)', () => {
    const config: RecurrenceConfig = { enabled: true, frequency: 'weekly', count: 0 };
    const result = generateRecurringDates('2026-05-13', config);
    expect(result).toEqual(['2026-05-13']);
  });

  it('preserves day-of-week from start date (Wednesday stays Wednesday)', () => {
    // 2026-05-13 is a Wednesday
    const config: RecurrenceConfig = { enabled: true, frequency: 'weekly', count: 5 };
    const result = generateRecurringDates('2026-05-13', config);
    for (const dateStr of result) {
      const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
      expect(dayOfWeek).toBe(3); // Wednesday
    }
  });

  it('handles month and year boundaries correctly', () => {
    const config: RecurrenceConfig = { enabled: true, frequency: 'weekly', count: 6 };
    // Start on Dec 17, 2026 (Wed) — crosses into Jan 2027
    const result = generateRecurringDates('2026-12-17', config);
    expect(result).toEqual([
      '2026-12-17',
      '2026-12-24',
      '2026-12-31',
      '2027-01-07',
      '2027-01-14',
      '2027-01-21',
    ]);
  });
});


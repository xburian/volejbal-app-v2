import { addWeeks, format } from 'date-fns';

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: 'weekly' | 'biweekly';
  count: number; // number of occurrences (including the first one)
}

const MAX_RECURRENCE_COUNT = 26;

/**
 * Generate an array of ISO date strings (YYYY-MM-DD) based on a start date and recurrence config.
 * If recurrence is disabled, returns just the start date.
 * Count is capped at 26 (half a year of weekly events).
 */
export function generateRecurringDates(startDate: string, config: RecurrenceConfig): string[] {
  if (!config.enabled) {
    return [startDate];
  }

  const count = Math.min(Math.max(config.count, 1), MAX_RECURRENCE_COUNT);
  const weeksToAdd = config.frequency === 'biweekly' ? 2 : 1;
  const start = new Date(startDate + 'T00:00:00');

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = addWeeks(start, i * weeksToAdd);
    dates.push(format(date, 'yyyy-MM-dd'));
  }

  return dates;
}


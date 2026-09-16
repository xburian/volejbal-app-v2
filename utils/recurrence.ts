import { addWeeks, format } from 'date-fns';

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: 'weekly' | 'biweekly';
  mode: 'count' | 'until';
  count: number; // number of occurrences (including the first one), used when mode === 'count'
  untilDate: string; // ISO YYYY-MM-DD, used when mode === 'until'
}

const MAX_RECURRENCE_COUNT = 26;

export function generateRecurringDates(startDate: string, config: RecurrenceConfig): string[] {
  if (!config.enabled) {
    return [startDate];
  }

  const weeksToAdd = config.frequency === 'biweekly' ? 2 : 1;
  const start = new Date(startDate + 'T00:00:00');

  if (config.mode === 'until') {
    if (config.untilDate < startDate) {
      return [startDate];
    }

    const dates: string[] = [];
    for (let i = 0; i < MAX_RECURRENCE_COUNT; i++) {
      const date = format(addWeeks(start, i * weeksToAdd), 'yyyy-MM-dd');
      if (date > config.untilDate) {
        break;
      }
      dates.push(date);
    }
    return dates;
  }

  const count = Math.min(Math.max(config.count, 1), MAX_RECURRENCE_COUNT);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = addWeeks(start, i * weeksToAdd);
    dates.push(format(date, 'yyyy-MM-dd'));
  }

  return dates;
}


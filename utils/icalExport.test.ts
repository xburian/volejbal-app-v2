import { describe, it, expect, vi } from 'vitest';
import { generateICS } from './icalExport';
import { SportEvent } from '../types';

// Mock date-fns startOfDay to use a fixed "today"
const MOCK_TODAY = new Date('2026-05-15T00:00:00');

vi.mock('date-fns', async () => {
  const actual = await vi.importActual<typeof import('date-fns')>('date-fns');
  return {
    ...actual,
    startOfDay: () => MOCK_TODAY,
  };
});

const makeEvent = (overrides: Partial<SportEvent> = {}): SportEvent => ({
  id: 'evt-1',
  title: 'Volejbal',
  date: '2026-05-20',
  time: '18:00',
  location: 'Hala',
  totalCost: 1000,
  accountNumber: '123/0100',
  participants: [],
  ...overrides,
});

describe('generateICS', () => {
  it('generates valid VCALENDAR structure', () => {
    const ics = generateICS([makeEvent()]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
  });

  it('sets correct DTSTART and DTEND (+2h)', () => {
    const ics = generateICS([makeEvent({ time: '18:00' })]);
    expect(ics).toContain('DTSTART:20260520T180000');
    expect(ics).toContain('DTEND:20260520T200000');
  });

  it('escapes special characters in title and location', () => {
    const ics = generateICS([makeEvent({ title: 'Volejbal, Tenis; a hra', location: 'Hala, Praha; 3' })]);
    expect(ics).toContain('SUMMARY:Volejbal\\, Tenis\\; a hra');
    expect(ics).toContain('LOCATION:Hala\\, Praha\\; 3');
  });

  it('includes cost and participant count in description', () => {
    const ics = generateICS([
      makeEvent({
        totalCost: 500,
        participants: [
          { userId: 'u1', name: 'A', status: 'joined', hasPaid: false },
          { userId: 'u2', name: 'B', status: 'declined', hasPaid: false },
        ],
      }),
    ]);
    expect(ics).toContain('Celková cena: 500 Kč');
    expect(ics).toContain('Účastníků: 1');
  });

  it('filters out past events', () => {
    const pastEvent = makeEvent({ id: 'past', date: '2026-05-10' });
    const futureEvent = makeEvent({ id: 'future', date: '2026-05-20' });
    const ics = generateICS([pastEvent, futureEvent]);
    expect(ics).not.toContain('past@sport-planovac');
    expect(ics).toContain('future@sport-planovac');
  });

  it('returns valid calendar with no events when all are past', () => {
    const ics = generateICS([makeEvent({ date: '2026-01-01' })]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('handles multiple events', () => {
    const events = [
      makeEvent({ id: 'e1', date: '2026-05-20' }),
      makeEvent({ id: 'e2', date: '2026-05-22' }),
      makeEvent({ id: 'e3', date: '2026-05-25' }),
    ];
    const ics = generateICS(events);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
  });

  it('uses event UID based on event id', () => {
    const ics = generateICS([makeEvent({ id: 'my-unique-id' })]);
    expect(ics).toContain('UID:my-unique-id@sport-planovac');
  });

  it('includes custom description in DESCRIPTION field', () => {
    const ics = generateICS([makeEvent({ description: 'Vzít si míč' })]);
    expect(ics).toContain('Vzít si míč');
  });
});


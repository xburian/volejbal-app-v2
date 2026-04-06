import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDebts } from './debt';
import { SportEvent, User } from '../types';

describe('calculateDebts', () => {
  const user: User = { id: 'u1', name: 'Alice' };

  const makeEvent = (overrides: Partial<SportEvent> = {}): SportEvent => ({
    id: 'e1',
    title: 'Game',
    date: '2026-03-20',
    time: '18:00',
    location: 'Hall',
    totalCost: 1000,
    accountNumber: '123/0100',
    participants: [],
    sportType: 'volejbal',
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array when no events', () => {
    expect(calculateDebts([], user)).toEqual([]);
  });

  it('returns empty array when user has no participation', () => {
    const events = [makeEvent()];
    expect(calculateDebts(events, user)).toEqual([]);
  });

  it('returns empty array when user has paid', () => {
    const events = [makeEvent({
      participants: [{ userId: 'u1', name: 'Alice', status: 'joined', hasPaid: true }],
    })];
    expect(calculateDebts(events, user)).toEqual([]);
  });

  it('returns empty array when user declined', () => {
    const events = [makeEvent({
      participants: [{ userId: 'u1', name: 'Alice', status: 'declined', hasPaid: false }],
    })];
    expect(calculateDebts(events, user)).toEqual([]);
  });

  it('returns empty array for events less than 2 days ago', () => {
    const events = [makeEvent({
      date: '2026-03-28', // 1 day ago
      participants: [{ userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false }],
    })];
    expect(calculateDebts(events, user)).toEqual([]);
  });

  it('detects unpaid debt for overdue event', () => {
    const events = [makeEvent({
      date: '2026-03-20', // 9 days ago
      totalCost: 1000,
      participants: [
        { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
        { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
      ],
    })];
    const debts = calculateDebts(events, user);
    expect(debts).toHaveLength(1);
    expect(debts[0].amount).toBe(500); // 1000 / 2
    expect(debts[0].daysOverdue).toBe(9);
  });

  it('rounds cost per person up', () => {
    const events = [makeEvent({
      date: '2026-03-20',
      totalCost: 1000,
      participants: [
        { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
        { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: false },
        { userId: 'u3', name: 'Carl', status: 'joined', hasPaid: false },
      ],
    })];
    const debts = calculateDebts(events, user);
    expect(debts[0].amount).toBe(334); // ceil(1000/3)
  });

  it('calculates multiple debts across events', () => {
    const events = [
      makeEvent({
        id: 'e1', date: '2026-03-20', totalCost: 600,
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
        ],
      }),
      makeEvent({
        id: 'e2', date: '2026-03-15', totalCost: 900,
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
          { userId: 'u3', name: 'Carl', status: 'joined', hasPaid: true },
        ],
      }),
    ];
    const debts = calculateDebts(events, user);
    expect(debts).toHaveLength(2);
    expect(debts[0].amount).toBe(300); // 600/2
    expect(debts[1].amount).toBe(300); // 900/3
  });

  it('ignores declined participants in cost split', () => {
    const events = [makeEvent({
      date: '2026-03-20', totalCost: 1000,
      participants: [
        { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
        { userId: 'u2', name: 'Bob', status: 'declined', hasPaid: false },
      ],
    })];
    const debts = calculateDebts(events, user);
    expect(debts[0].amount).toBe(1000); // only 1 joined
  });

  it('returns empty array when user is on waitlist', () => {
    const events = [makeEvent({
      date: '2026-03-20',
      participants: [{ userId: 'u1', name: 'Alice', status: 'waitlist', hasPaid: false }],
    })];
    expect(calculateDebts(events, user)).toEqual([]);
  });

  it('ignores waitlisted participants in cost split', () => {
    const events = [makeEvent({
      date: '2026-03-20', totalCost: 1000,
      participants: [
        { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
        { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
        { userId: 'u3', name: 'Carl', status: 'waitlist', hasPaid: false },
      ],
    })];
    const debts = calculateDebts(events, user);
    expect(debts[0].amount).toBe(500); // 1000/2, waitlisted Carl excluded
  });

  it('calculates debts correctly for different sport types', () => {
    const events = [
      makeEvent({
        id: 'e1', date: '2026-03-20', totalCost: 500, sportType: 'tenis',
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
        ],
      }),
      makeEvent({
        id: 'e2', date: '2026-03-15', totalCost: 1000, sportType: 'volejbal',
        participants: [
          { userId: 'u1', name: 'Alice', status: 'joined', hasPaid: false },
          { userId: 'u2', name: 'Bob', status: 'joined', hasPaid: true },
        ],
      }),
    ];
    const debts = calculateDebts(events, user);
    expect(debts).toHaveLength(2);
    expect(debts[0].amount).toBe(250); // tenis: 500/2
    expect(debts[1].amount).toBe(500); // volejbal: 1000/2
  });
});

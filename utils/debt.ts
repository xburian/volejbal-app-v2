import { SportEvent, DebtItem, User } from '../types';
import { differenceInCalendarDays } from 'date-fns';

/**
 * Calculate unpaid debts for a given user across all events.
 * Pure function — easy to test without any React.
 */
export function calculateDebts(events: SportEvent[], currentUser: User): DebtItem[] {
  const today = new Date();
  const debts: DebtItem[] = [];

  events.forEach(event => {
    const eventDate = new Date(event.date);
    const diff = differenceInCalendarDays(today, eventDate);

    // Not overdue yet (event is today or in the future, or only 1 day ago)
    if (diff <= 1) return;

    const myParticipation = event.participants.find(p => p.userId === currentUser.id);

    // Only count if user joined AND has NOT paid
    if (!myParticipation || myParticipation.status !== 'joined' || myParticipation.hasPaid) return;

    const joinedCount = event.participants.filter(p => p.status === 'joined').length;
    const costPerPerson = joinedCount > 0 ? Math.ceil(event.totalCost / joinedCount) : 0;

    debts.push({ event, amount: costPerPerson, daysOverdue: diff });
  });

  return debts;
}


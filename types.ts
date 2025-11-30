export interface User {
  id: string;
  name: string;
}

export interface Participant {
  userId: string; // Foreign key to User
  name: string;   // Denormalized name for display
  status: 'joined' | 'declined' | 'maybe';
  hasPaid: boolean;
}

export interface VolleyballEvent {
  id: string;
  title: string;
  date: string; // ISO string YYYY-MM-DD
  time: string;
  location: string;
  totalCost: number;
  accountNumber: string; // e.g., 123456789/0100
  description?: string;
  participants: Participant[]; // Constructed/Hydrated array, not necessarily stored directly
}

export interface AttendanceRecord {
  eventId: string;
  userId: string;
  status: 'joined' | 'declined' | 'maybe';
  hasPaid: boolean;
  timestamp: number;
}

export interface DebtItem {
  event: VolleyballEvent;
  amount: number;
  daysOverdue: number;
}

export type ViewMode = 'calendar' | 'list';
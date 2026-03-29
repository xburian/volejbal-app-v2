export interface User {
  id: string;
  name: string;
  photoUrl?: string; // URL or base64 encoded image
}

export interface BankAccount {
  id: string;
  ownerName: string;
  accountNumber: string; // e.g., 123456789/0100
  userId: string; // Personal account belonging to a user
}

export interface Participant {
  userId: string; // Foreign key to User
  name: string;   // Denormalized name for display
  photoUrl?: string; // Denormalized photo for display
  status: 'joined' | 'declined' | 'maybe';
  hasPaid: boolean;
}

export interface TeamMember {
  userId: string;
  name: string;
  photoUrl?: string;
}

export interface GameRound {
  teams: [TeamMember[], TeamMember[]];
  winningTeam?: 0 | 1;
}

export interface VolleyballEvent {
  id: string;
  title: string;
  date: string; // ISO string YYYY-MM-DD
  time: string;
  location: string;
  totalCost: number;
  accountNumber: string; // e.g., 123456789/0100
  selectedBankAccountId?: string; // ID of selected bank account from the bank accounts list
  description?: string;
  participants: Participant[]; // Constructed/Hydrated array, not necessarily stored directly
  teams?: [TeamMember[], TeamMember[]]; // current round team split
  winningTeam?: 0 | 1; // current round winner
  gameHistory?: GameRound[]; // completed previous rounds
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

export interface UserStats {
  userId: string;
  name: string;
  photoUrl?: string;
  totalEvents: number;        // events where user has any participation record
  eventsJoined: number;
  eventsDeclined: number;
  eventsMaybe: number;
  attendanceRate: number;     // eventsJoined / totalEvents (0-1)
  paymentRate: number;        // timesPaid / eventsJoined (0-1)
  totalPaid: number;          // sum of cost-per-person for paid events (CZK)
  totalOwed: number;          // sum of cost-per-person for unpaid joined events (CZK)
  longestStreak: number;      // consecutive joined events by date
  currentStreak: number;
  favoriteLocation: string;
  gamesPlayed: number;        // events with teams + winner recorded
  gamesWon: number;
  winRate: number;             // gamesWon / gamesPlayed (0-1)
  winStreak: number;           // current consecutive wins
  longestWinStreak: number;
}

export interface MonthlyTrend {
  month: string;              // 'YYYY-MM'
  label: string;              // e.g. 'Led 2026'
  eventCount: number;
  averageAttendance: number;
  totalParticipants: number;
}

export interface DuoStats {
  players: [{ userId: string; name: string; photoUrl?: string }, { userId: string; name: string; photoUrl?: string }];
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export type BadgeType = 'ironman' | 'ghost' | 'maybeMaster' | 'quickPayer' | 'socialButterfly' | 'luckyPlayer';

export interface Badge {
  type: BadgeType;
  label: string;
  description: string;
  iconName: string;
  userId: string;
  userName: string;
  photoUrl?: string;
  value: string;
}
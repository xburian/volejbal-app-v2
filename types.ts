export type SportType = 'volejbal' | 'tenis' | 'badminton';

/** Runtime array of allowed sport types — used for validation / filtering */
export const VALID_SPORT_TYPES: SportType[] = ['volejbal', 'tenis', 'badminton'];

export const SPORT_EMOJI: Record<SportType, string> = {
  volejbal: '🏐',
  tenis: '🎾',
  badminton: '🏸',
};

/** Mask a bank account number, showing only the last 8 characters */
export const maskAccountNumber = (accountNumber: string): string => {
  if (accountNumber.length <= 8) return accountNumber;
  return '•••' + accountNumber.slice(-8);
};

export interface SportConfig {
  type: SportType;
  label: string;
  maxPlayers: number;
  defaultCost: number;
  defaultLocation: string;
  /** null = split evenly into 2 teams, number = fixed team size (e.g. 2 for doubles) */
  teamSize: number | null;
}

export const DEFAULT_SPORT_CONFIGS: SportConfig[] = [
  { type: 'volejbal', label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null },
  { type: 'tenis', label: 'Tenis', maxPlayers: 4, defaultCost: 500, defaultLocation: 'Tenisový kurt', teamSize: 2 },
  { type: 'badminton', label: 'Badminton', maxPlayers: 4, defaultCost: 400, defaultLocation: 'Sportovní centrum', teamSize: 2 },
];

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
  status: 'joined' | 'declined' | 'maybe' | 'waitlist';
  hasPaid: boolean;
}

export interface TeamMember {
  userId: string;
  name: string;
  photoUrl?: string;
}

/** Default team animal names — randomly assigned on shuffle */
export const TEAM_COLOR_NAMES = [
  'Vlci', 'Orli', 'Medvědi', 'Tygři', 'Lvi', 'Panteři', 'Jestřábi', 'Sokoli', 'Rysové', 'Žraloci',
] as const;

export interface GameRound {
  teams: [TeamMember[], TeamMember[]];
  teamNames?: [string, string];
  winningTeam?: 0 | 1;
  /** Set scores for the round, e.g. [[25,20],[25,18],[22,25]] */
  score?: [number, number][];
}

export interface SportEvent {
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
  teamNames?: [string, string]; // current round team names
  winningTeam?: 0 | 1; // current round winner
  /** Set scores for the current round */
  score?: [number, number][];
  gameHistory?: GameRound[]; // completed previous rounds
  sportType?: SportType; // optional for backward compat — defaults to 'volejbal'
}

/** @deprecated Use SportEvent instead */
export type VolleyballEvent = SportEvent;

export interface AttendanceRecord {
  eventId: string;
  userId: string;
  status: 'joined' | 'declined' | 'maybe' | 'waitlist';
  hasPaid: boolean;
  timestamp: number;
}

export interface DebtItem {
  event: SportEvent;
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
  setsWon: number;
  setsLost: number;
  setWinRate: number;          // setsWon / (setsWon + setsLost) (0-1)
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
  setsWon: number;
  setsLost: number;
  setWinRate: number;
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
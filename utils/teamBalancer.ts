import { SportEvent, Participant, TeamMember, GameRound } from '../types';

export interface PlayerRating {
  userId: string;
  name: string;
  photoUrl?: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  /** Average set win ratio across all sets played (0–1). Captures margin of victory. */
  setWinRatio: number;
  /** Effective rating used for balancing (may be averaged if below threshold) */
  effectiveRating: number;
  /** Whether the player has enough data to have a reliable rating */
  hasEnoughData: boolean;
}

/** Default minimum number of games a player must have played for their rating to be considered reliable */
export const DEFAULT_MIN_GAMES_THRESHOLD = 3;

/** Weight given to win rate vs set performance when computing effective rating */
const WIN_RATE_WEIGHT = 0.6;
const SET_PERFORMANCE_WEIGHT = 0.4;

/**
 * Extract all completed rounds from an event (game history + current round if finished).
 */
export function extractRounds(event: SportEvent): GameRound[] {
  const rounds: GameRound[] = [...(event.gameHistory || [])];
  if (event.teams && event.winningTeam !== undefined) {
    rounds.push({
      teams: event.teams,
      teamNames: event.teamNames,
      winningTeam: event.winningTeam,
      score: event.score,
    });
  }
  return rounds;
}

/**
 * Compute a performance rating for each player based on historical win/loss data
 * and set scores.
 *
 * The effective rating blends:
 *   - **Win rate** (60%): fraction of games won
 *   - **Set performance** (40%): average ratio of own-set-points / total-set-points
 *     across all sets the player participated in.
 *
 * Players below the minimum data threshold receive an "average" rating
 * computed from all players who *do* have enough data. If nobody has enough
 * data, every player gets a neutral 0.5 rating.
 */
export function computePlayerRatings(
  allEvents: SportEvent[],
  players: Participant[],
  minGamesThreshold: number = DEFAULT_MIN_GAMES_THRESHOLD,
): PlayerRating[] {
  // Per-player accumulators
  const statsMap = new Map<string, {
    played: number;
    won: number;
    setRatioSum: number;
    setCount: number;
  }>();

  for (const event of allEvents) {
    const rounds = extractRounds(event);

    for (const round of rounds) {
      if (round.winningTeam === undefined) continue;
      const winners = round.teams[round.winningTeam];
      const losers = round.teams[1 - round.winningTeam];

      for (const member of [...winners, ...losers]) {
        if (!statsMap.has(member.userId)) {
          statsMap.set(member.userId, { played: 0, won: 0, setRatioSum: 0, setCount: 0 });
        }
        const s = statsMap.get(member.userId)!;
        s.played++;
        if (winners.some(w => w.userId === member.userId)) {
          s.won++;
        }

        // Accumulate set-level performance if scores are available
        if (round.score && round.score.length > 0) {
          const isTeam0 = round.teams[0].some(m => m.userId === member.userId);
          for (const [s0, s1] of round.score) {
            const total = s0 + s1;
            if (total === 0) continue;
            const own = isTeam0 ? s0 : s1;
            s.setRatioSum += own / total;
            s.setCount++;
          }
        }
      }
    }
  }

  // Build raw ratings for each player in the current list
  const rawRatings: PlayerRating[] = players.map(p => {
    const s = statsMap.get(p.userId);
    const played = s?.played ?? 0;
    const won = s?.won ?? 0;
    const winRate = played > 0 ? won / played : 0;
    const setWinRatio = s && s.setCount > 0 ? s.setRatioSum / s.setCount : 0.5;
    return {
      userId: p.userId,
      name: p.name,
      photoUrl: p.photoUrl,
      gamesPlayed: played,
      gamesWon: won,
      winRate,
      setWinRatio,
      effectiveRating: 0, // computed below
      hasEnoughData: played >= minGamesThreshold,
    };
  });

  // Compute blended rating for players with enough data
  for (const r of rawRatings) {
    if (r.hasEnoughData) {
      r.effectiveRating = WIN_RATE_WEIGHT * r.winRate + SET_PERFORMANCE_WEIGHT * r.setWinRatio;
    }
  }

  // Compute average rating from players with enough data
  const reliable = rawRatings.filter(r => r.hasEnoughData);
  const averageRating =
    reliable.length > 0
      ? reliable.reduce((sum, r) => sum + r.effectiveRating, 0) / reliable.length
      : 0.5; // neutral when nobody has data

  // Assign effective rating for players below threshold
  for (const r of rawRatings) {
    if (!r.hasEnoughData) {
      r.effectiveRating = averageRating;
    }
  }

  return rawRatings;
}

/**
 * Balance players into two teams using a **snake-draft** approach:
 *
 * 1. Sort players by effectiveRating descending.
 * 2. Alternate picks: best → team A, 2nd → team B, 3rd → team B, 4th → team A, …
 *    (snake order ensures both teams get a mix of strong/weak players).
 *
 * Supports both fixed `teamSize` (e.g., doubles) and even split (teamSize = null).
 *
 * Returns `null` if there aren't enough players for two teams.
 */
export function balanceTeams(
  players: Participant[],
  allEvents: SportEvent[],
  options: {
    teamSize: number | null;
    minGamesThreshold?: number;
  } = { teamSize: null },
): [TeamMember[], TeamMember[]] | null {
  const { teamSize, minGamesThreshold = DEFAULT_MIN_GAMES_THRESHOLD } = options;

  const minPlayers = teamSize !== null ? teamSize * 2 : 2;
  if (players.length < minPlayers) return null;

  const ratings = computePlayerRatings(allEvents, players, minGamesThreshold);

  // Sort by effective rating descending (strongest first)
  const sorted = [...ratings].sort((a, b) => b.effectiveRating - a.effectiveRating);

  // Determine how many players per team
  let pickCount: number;
  if (teamSize !== null) {
    pickCount = teamSize * 2;
  } else {
    pickCount = sorted.length;
  }

  const toMember = (r: PlayerRating): TeamMember => ({
    userId: r.userId,
    name: r.name,
    photoUrl: r.photoUrl,
  });

  const team0: TeamMember[] = [];
  const team1: TeamMember[] = [];

  // Snake draft
  for (let i = 0; i < Math.min(pickCount, sorted.length); i++) {
    const round = Math.floor(i / 2);
    const isEvenRound = round % 2 === 0;
    const pickFirst = i % 2 === 0;

    if (teamSize !== null) {
      if (team0.length < teamSize && (pickFirst || team1.length >= teamSize)) {
        team0.push(toMember(sorted[i]));
      } else {
        team1.push(toMember(sorted[i]));
      }
    } else {
      if (pickFirst === isEvenRound) {
        if (team0.length <= team1.length) {
          team0.push(toMember(sorted[i]));
        } else {
          team1.push(toMember(sorted[i]));
        }
      } else {
        if (team1.length <= team0.length) {
          team1.push(toMember(sorted[i]));
        } else {
          team0.push(toMember(sorted[i]));
        }
      }
    }
  }

  return [team0, team1];
}

/**
 * Compute total effective rating for a team (useful for tests / debugging).
 */
export function teamRating(
  team: TeamMember[],
  ratings: PlayerRating[],
): number {
  return team.reduce((sum, m) => {
    const r = ratings.find(r => r.userId === m.userId);
    return sum + (r?.effectiveRating ?? 0.5);
  }, 0);
}

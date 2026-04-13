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

/** Available balancing strategies */
export type BalancingStrategy = 'jittered-snake' | 'greedy-swap' | 'random-partition';

/** All strategies in rotation order */
export const ALL_STRATEGIES: BalancingStrategy[] = ['jittered-snake', 'greedy-swap', 'random-partition'];

/**
 * Extract all completed rounds from an event (game history + current round if finished).
 */
export function extractRounds(event: SportEvent): GameRound[] {
  const rounds: GameRound[] = [...(Array.isArray(event.gameHistory) ? event.gameHistory : [])];
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

// ── Helper: Convert PlayerRating → TeamMember ──

const toMember = (r: PlayerRating): TeamMember => ({
  userId: r.userId,
  name: r.name,
  photoUrl: r.photoUrl,
});

// ── Helper: Check if two team configurations are the same ──

export function teamsAreSame(
  a: [TeamMember[], TeamMember[]],
  b: [TeamMember[], TeamMember[]],
): boolean {
  const idsA0 = new Set(a[0].map(m => m.userId));
  const idsA1 = new Set(a[1].map(m => m.userId));
  const idsB0 = new Set(b[0].map(m => m.userId));
  const idsB1 = new Set(b[1].map(m => m.userId));

  const setsEqual = (x: Set<string>, y: Set<string>) =>
    x.size === y.size && [...x].every(id => y.has(id));

  // Same if (A0≡B0 and A1≡B1) or (A0≡B1 and A1≡B0) — teams can be swapped
  return (
    (setsEqual(idsA0, idsB0) && setsEqual(idsA1, idsB1)) ||
    (setsEqual(idsA0, idsB1) && setsEqual(idsA1, idsB0))
  );
}

// ── Helper: Sum effective rating of a team ──

function sumRating(team: PlayerRating[]): number {
  return team.reduce((s, r) => s + r.effectiveRating, 0);
}

// ── Strategy 1: Jittered Snake Draft ──
// Adds controlled random noise to ratings before sorting, so players with
// similar ratings get ordered differently each time.

export function jitteredSnakeDraft(
  ratings: PlayerRating[],
  teamSize: number | null,
  jitterFactor: number = 0.2,
): [TeamMember[], TeamMember[]] {
  const maxR = Math.max(...ratings.map(r => r.effectiveRating), 0.001);
  const minR = Math.min(...ratings.map(r => r.effectiveRating));
  const spread = Math.max(maxR - minR, 0.1);

  const jittered = ratings.map(r => ({
    ...r,
    _jittered: r.effectiveRating + (Math.random() - 0.5) * spread * jitterFactor,
  }));
  jittered.sort((a, b) => b._jittered - a._jittered);

  const pickCount = teamSize !== null ? teamSize * 2 : jittered.length;
  const team0: TeamMember[] = [];
  const team1: TeamMember[] = [];

  for (let i = 0; i < Math.min(pickCount, jittered.length); i++) {
    const round = Math.floor(i / 2);
    const isEvenRound = round % 2 === 0;
    const pickFirst = i % 2 === 0;

    if (teamSize !== null) {
      if (team0.length < teamSize && (pickFirst || team1.length >= teamSize)) {
        team0.push(toMember(jittered[i]));
      } else {
        team1.push(toMember(jittered[i]));
      }
    } else {
      if (pickFirst === isEvenRound) {
        (team0.length <= team1.length ? team0 : team1).push(toMember(jittered[i]));
      } else {
        (team1.length <= team0.length ? team1 : team0).push(toMember(jittered[i]));
      }
    }
  }

  return [team0, team1];
}

// ── Strategy 2: Greedy Swap ──
// Start with a random partition, then greedily swap players between teams
// to minimize the total rating difference.

export function greedySwapBalance(
  ratings: PlayerRating[],
  teamSize: number | null,
): [TeamMember[], TeamMember[]] {
  // 1. Random initial partition
  const shuffled = [...ratings].sort(() => Math.random() - 0.5);
  const size = teamSize ?? Math.ceil(shuffled.length / 2);
  const team0: PlayerRating[] = shuffled.slice(0, size);
  const team1: PlayerRating[] = shuffled.slice(size, teamSize !== null ? size * 2 : undefined);

  // 2. Greedy pairwise swaps to minimize rating difference
  const MAX_PASSES = 50;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    const s0 = sumRating(team0);
    const s1 = sumRating(team1);
    const currentDiff = Math.abs(s0 - s1);

    for (let i = 0; i < team0.length; i++) {
      for (let j = 0; j < team1.length; j++) {
        const newS0 = s0 - team0[i].effectiveRating + team1[j].effectiveRating;
        const newS1 = s1 - team1[j].effectiveRating + team0[i].effectiveRating;
        if (Math.abs(newS0 - newS1) < currentDiff - 0.001) {
          const tmp = team0[i];
          team0[i] = team1[j];
          team1[j] = tmp;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
    if (!improved) break;
  }

  return [team0.map(toMember), team1.map(toMember)];
}

// ── Strategy 3: Random Partition with Hill-Climbing ──
// Randomly shuffle players, split in half, then repeatedly move
// the highest-rated player from the heavier team to the lighter team.

export function randomPartitionBalance(
  ratings: PlayerRating[],
  teamSize: number | null,
): [TeamMember[], TeamMember[]] {
  const shuffled = [...ratings].sort(() => Math.random() - 0.5);
  const size = teamSize ?? Math.ceil(shuffled.length / 2);
  const team0: PlayerRating[] = shuffled.slice(0, size);
  const team1: PlayerRating[] = shuffled.slice(size, teamSize !== null ? size * 2 : undefined);

  // Hill-climbing: repeatedly swap the member that most reduces imbalance
  const MAX_ITER = 30;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const s0 = sumRating(team0);
    const s1 = sumRating(team1);
    const currentDiff = Math.abs(s0 - s1);
    if (currentDiff < 0.01) break;

    let bestSwap: { i: number; j: number; newDiff: number } | null = null;

    for (let i = 0; i < team0.length; i++) {
      for (let j = 0; j < team1.length; j++) {
        const newS0 = s0 - team0[i].effectiveRating + team1[j].effectiveRating;
        const newS1 = s1 - team1[j].effectiveRating + team0[i].effectiveRating;
        const newDiff = Math.abs(newS0 - newS1);
        if (newDiff < currentDiff && (!bestSwap || newDiff < bestSwap.newDiff)) {
          bestSwap = { i, j, newDiff };
        }
      }
    }

    if (!bestSwap) break;
    const tmp = team0[bestSwap.i];
    team0[bestSwap.i] = team1[bestSwap.j];
    team1[bestSwap.j] = tmp;
  }

  return [team0.map(toMember), team1.map(toMember)];
}

/**
 * Balance players into two teams using one of multiple strategies.
 *
 * When `previousTeams` is provided, the algorithm tries up to `maxAttempts`
 * times across different strategies to produce a **different** team
 * configuration. This ensures that clicking "Zamíchat" always changes
 * the teams.
 *
 * Strategies rotate through:
 * - **jittered-snake**: Snake draft with random noise on ratings
 * - **greedy-swap**: Random partition → greedy optimization
 * - **random-partition**: Random partition → hill-climbing optimization
 *
 * All strategies maintain balance: the total rating difference between
 * teams stays small.
 *
 * Returns `null` if there aren't enough players for two teams.
 */
export function balanceTeams(
  players: Participant[],
  allEvents: SportEvent[],
  options: {
    teamSize: number | null;
    minGamesThreshold?: number;
    /** Current/previous teams — algorithm avoids producing the same split */
    previousTeams?: [TeamMember[], TeamMember[]] | null;
    /** Maximum attempts to find a different configuration (default 12) */
    maxAttempts?: number;
    /** Force a specific strategy (default: rotate through all) */
    strategy?: BalancingStrategy;
  } = { teamSize: null },
): [TeamMember[], TeamMember[]] | null {
  const {
    teamSize,
    minGamesThreshold = DEFAULT_MIN_GAMES_THRESHOLD,
    previousTeams,
    maxAttempts = 12,
    strategy,
  } = options;

  const minPlayers = teamSize !== null ? teamSize * 2 : 2;
  if (players.length < minPlayers) return null;

  const ratings = computePlayerRatings(allEvents, players, minGamesThreshold);

  // Generate candidates across strategies, pick first that differs from previous
  let bestCandidate: [TeamMember[], TeamMember[]] | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const strat = strategy ?? ALL_STRATEGIES[attempt % ALL_STRATEGIES.length];

    let candidate: [TeamMember[], TeamMember[]];
    switch (strat) {
      case 'jittered-snake':
        candidate = jitteredSnakeDraft(ratings, teamSize);
        break;
      case 'greedy-swap':
        candidate = greedySwapBalance(ratings, teamSize);
        break;
      case 'random-partition':
        candidate = randomPartitionBalance(ratings, teamSize);
        break;
    }

    if (!bestCandidate) bestCandidate = candidate;

    // If no previous teams to avoid, return first result
    if (!previousTeams) return candidate;

    // If this candidate differs from previous, use it
    if (!teamsAreSame(candidate, previousTeams)) {
      return candidate;
    }

    // Store as fallback
    bestCandidate = candidate;
  }

  // If all attempts produced the same as previous (e.g. only 2 players),
  // return it anyway
  return bestCandidate;
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

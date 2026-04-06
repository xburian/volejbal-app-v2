import { Participant, SportConfig, TeamMember, TEAM_COLOR_NAMES } from '../../types';

/** Pick two random distinct team color names */
export const pickRandomTeamNames = (): [string, string] => {
  const shuffled = [...TEAM_COLOR_NAMES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
};

/**
 * Incrementally update existing teams when participants join or leave.
 * - Removes team members who are no longer in the joined list.
 * - Adds new joined participants to the smaller team.
 * - Keeps existing assignments stable (no full re-shuffle).
 * Returns null if teams don't exist or there aren't enough players.
 */
export const updateTeamsForParticipantChange = (
  currentTeams: [TeamMember[], TeamMember[]] | undefined,
  newJoined: Participant[],
  sportConfig: SportConfig,
): [TeamMember[], TeamMember[]] | null => {
  if (!currentTeams) return null;

  const joinedIds = new Set(newJoined.map(p => p.userId));

  // Remove players who left from their teams
  let team0 = currentTeams[0].filter(m => joinedIds.has(m.userId));
  let team1 = currentTeams[1].filter(m => joinedIds.has(m.userId));

  // Find newly joined players not yet assigned to any team
  const assignedIds = new Set([...team0, ...team1].map(m => m.userId));
  const newPlayers = newJoined.filter(p => !assignedIds.has(p.userId));

  // Add each new player to the smaller team
  for (const p of newPlayers) {
    const member: TeamMember = { userId: p.userId, name: p.name, photoUrl: p.photoUrl };
    if (team0.length <= team1.length) {
      team0 = [...team0, member];
    } else {
      team1 = [...team1, member];
    }
  }

  // If not enough players for teams, clear them
  const teamSize = sportConfig.teamSize;
  const minPlayers = teamSize !== null ? teamSize * 2 : 2;
  if (team0.length + team1.length < minPlayers) return null;

  return [team0, team1];
};


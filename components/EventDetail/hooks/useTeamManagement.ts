import { useState, useEffect } from 'react';
import { SportEvent, Participant, SportConfig, TeamMember } from '@/types.ts';
import { balanceTeams } from '@/utils/teamBalancer.ts';
import { pickRandomTeamNames, updateTeamsForParticipantChange } from '../teamUtils';

interface UseTeamManagementProps {
  event: SportEvent;
  joinedParticipants: Participant[];
  sportConfig: SportConfig;
  allEvents: SportEvent[];
  onUpdate: (event: SportEvent) => void;
  onScoreReset: () => void;
}

export function useTeamManagement({
  event,
  joinedParticipants,
  sportConfig,
  allEvents,
  onUpdate,
  onScoreReset,
}: UseTeamManagementProps) {
  const [editingTeamNameIdx, setEditingTeamNameIdx] = useState<0 | 1 | null>(null);
  const [tempTeamName, setTempTeamName] = useState('');

  const minPlayersForTeams = sportConfig.teamSize !== null ? sportConfig.teamSize * 2 : 2;
  const canShuffleTeams = joinedParticipants.length >= minPlayersForTeams;

  const shuffleTeams = async () => {
    const teamSize = sportConfig.teamSize;

    // Pass current teams so the balancer avoids producing the same split
    const balanced = balanceTeams(joinedParticipants, allEvents, {
      teamSize,
      previousTeams: event.teams ?? null,
    });

    let newTeams: [TeamMember[], TeamMember[]];
    if (balanced) {
      newTeams = balanced;
    } else {
      const shuffled = [...joinedParticipants].sort(() => Math.random() - 0.5);
      if (teamSize !== null) {
        newTeams = [
          shuffled.slice(0, teamSize).map(p => ({ userId: p.userId, name: p.name, photoUrl: p.photoUrl })),
          shuffled.slice(teamSize, teamSize * 2).map(p => ({ userId: p.userId, name: p.name, photoUrl: p.photoUrl })),
        ];
      } else {
        const mid = Math.ceil(shuffled.length / 2);
        newTeams = [
          shuffled.slice(0, mid).map(p => ({ userId: p.userId, name: p.name, photoUrl: p.photoUrl })),
          shuffled.slice(mid).map(p => ({ userId: p.userId, name: p.name, photoUrl: p.photoUrl })),
        ];
      }
    }

    // If current round has a winner, save it to history before starting new round
    const history = [...(event.gameHistory || [])];
    if (event.teams && event.winningTeam !== undefined) {
      history.push({ teams: event.teams, teamNames: event.teamNames, winningTeam: event.winningTeam, score: event.score });
    }

    const newTeamNames = pickRandomTeamNames();
    onScoreReset();
    onUpdate({ ...event, teams: newTeams, teamNames: newTeamNames, winningTeam: undefined, score: undefined, gameHistory: history });
  };

  const setWinner = (teamIdx: 0 | 1) => {
    onUpdate({ ...event, winningTeam: teamIdx });
  };

  const handleStartEditTeamName = (idx: 0 | 1) => {
    setEditingTeamNameIdx(idx);
    setTempTeamName(event.teamNames?.[idx] ?? `Tým ${idx + 1}`);
  };

  const handleSaveTeamName = () => {
    if (editingTeamNameIdx === null || !event.teamNames) return;
    const newNames: [string, string] = [...event.teamNames] as [string, string];
    newNames[editingTeamNameIdx] = tempTeamName.trim() || newNames[editingTeamNameIdx];
    onUpdate({ ...event, teamNames: newNames });
    setEditingTeamNameIdx(null);
    setTempTeamName('');
  };

  const handleCancelEditTeamName = () => {
    setEditingTeamNameIdx(null);
    setTempTeamName('');
  };

  // Auto-generate/update teams when participants change
  useEffect(() => {
    if (!event.teams && joinedParticipants.length >= minPlayersForTeams) {
      shuffleTeams();
    } else if (event.teams) {
      const updatedTeams = updateTeamsForParticipantChange(event.teams, joinedParticipants, sportConfig);
      if (updatedTeams === null) {
        onUpdate({ ...event, teams: undefined, teamNames: undefined, winningTeam: undefined });
      } else {
        const currentIds = event.teams.flatMap(t => t.map(m => m.userId)).sort().join(',');
        const newIds = updatedTeams.flatMap(t => t.map(m => m.userId)).sort().join(',');
        if (currentIds !== newIds) {
          onUpdate({ ...event, teams: updatedTeams });
        }
      }
    }
  }, [event.id, joinedParticipants.length]);

  return {
    shuffleTeams,
    setWinner,
    handleStartEditTeamName,
    handleSaveTeamName,
    handleCancelEditTeamName,
    editingTeamNameIdx,
    tempTeamName,
    setTempTeamName,
    canShuffleTeams,
    minPlayersForTeams,
  };
}

export type TeamManagement = ReturnType<typeof useTeamManagement>;


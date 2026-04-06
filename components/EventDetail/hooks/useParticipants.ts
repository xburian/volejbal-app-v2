import { useState } from 'react';
import { SportEvent, Participant, User, SportConfig } from '@/types.ts';
import * as storage from '@/services/storage.ts';
import { updateTeamsForParticipantChange } from '../teamUtils';

interface UseParticipantsProps {
  event: SportEvent;
  currentUser: User;
  sportConfig: SportConfig;
  onUpdate: (event: SportEvent) => void;
}

export function useParticipants({ event, currentUser, sportConfig, onUpdate }: UseParticipantsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());
  const [capacityError, setCapacityError] = useState<string | null>(null);

  const startSaving = (userId: string) => setSavingUsers(prev => new Set(prev).add(userId));
  const stopSaving = (userId: string) => setSavingUsers(prev => { const next = new Set(prev); next.delete(userId); return next; });

  const currentUserParticipant = event.participants.find(p => p.userId === currentUser.id);
  const isCurrentUserJoined = currentUserParticipant?.status === 'joined';

  const refreshEventData = async () => {
    setIsLoading(true);
    const allEvents = await storage.getEvents();
    const refreshed = allEvents.find(e => e.id === event.id);
    if (refreshed) {
      onUpdate(refreshed);
    }
    setIsLoading(false);
  };

  const handleStatusChange = async (userId: string, status: Participant['status']) => {
    let effectiveStatus = status;
    if (status === 'joined') {
      const currentJoined = event.participants.filter(p => p.status === 'joined');
      const isAlreadyJoined = currentJoined.some(p => p.userId === userId);
      if (!isAlreadyJoined && currentJoined.length >= sportConfig.maxPlayers) {
        effectiveStatus = 'waitlist';
        setCapacityError(`Kapacita ${sportConfig.maxPlayers} hráčů je plná — zařazeni do čekací listiny.`);
        setTimeout(() => setCapacityError(null), 3000);
      }
    }
    setCapacityError(null);

    const prevParticipants = event.participants;
    const existing = prevParticipants.find(p => p.userId === userId);

    let optimisticParticipants: Participant[];
    if (existing) {
      optimisticParticipants = prevParticipants.map(p =>
        p.userId === userId ? { ...p, status: effectiveStatus } : p
      );
    } else {
      optimisticParticipants = [
        ...prevParticipants,
        { userId, name: currentUser.name, photoUrl: currentUser.photoUrl, status: effectiveStatus, hasPaid: false },
      ];
    }

    // Auto-promote first waitlisted user when someone leaves/declines
    if ((status === 'declined' || status === 'maybe') && existing?.status === 'joined') {
      const waitlisted = optimisticParticipants.filter(p => p.status === 'waitlist');
      if (waitlisted.length > 0) {
        const promoted = waitlisted[0];
        optimisticParticipants = optimisticParticipants.map(p =>
          p.userId === promoted.userId ? { ...p, status: 'joined' as const } : p
        );
        storage.updateAttendance(event.id, promoted.userId, 'joined').catch(() => {});
      }
    }

    // Update teams to reflect participant change
    const optimisticJoined = optimisticParticipants.filter(p => p.status === 'joined');
    const updatedTeams = updateTeamsForParticipantChange(event.teams, optimisticJoined, sportConfig);
    const teamUpdates: Partial<SportEvent> = {};
    if (event.teams) {
      if (updatedTeams === null) {
        teamUpdates.teams = undefined;
        teamUpdates.teamNames = undefined;
        teamUpdates.winningTeam = undefined;
      } else {
        teamUpdates.teams = updatedTeams;
      }
    }
    onUpdate({ ...event, participants: optimisticParticipants, ...teamUpdates });
    startSaving(userId);

    try {
      await storage.updateAttendance(event.id, userId, effectiveStatus);
      const allEvents = await storage.getEvents();
      const refreshed = allEvents.find(e => e.id === event.id);
      if (refreshed) onUpdate(refreshed);
    } catch {
      onUpdate({ ...event, participants: prevParticipants });
    } finally {
      stopSaving(userId);
    }
  };

  const handlePaymentToggle = async (userId: string, currentStatus: boolean) => {
    const participant = event.participants.find(p => p.userId === userId);
    if (!participant) return;

    const prevParticipants = event.participants;
    const optimisticParticipants = prevParticipants.map(p =>
      p.userId === userId ? { ...p, hasPaid: !currentStatus } : p
    );
    onUpdate({ ...event, participants: optimisticParticipants });
    startSaving(userId);

    try {
      await storage.updateAttendance(event.id, userId, participant.status, !currentStatus);
    } catch {
      onUpdate({ ...event, participants: prevParticipants });
    } finally {
      stopSaving(userId);
    }
  };

  return {
    isLoading,
    savingUsers,
    capacityError,
    currentUserParticipant,
    isCurrentUserJoined,
    refreshEventData,
    handleStatusChange,
    handlePaymentToggle,
  };
}

export type ParticipantsState = ReturnType<typeof useParticipants>;


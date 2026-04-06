import React, { useMemo, useState, useEffect } from 'react';
import { SportEvent, Participant, User, BankAccount, TeamMember, SportConfig, TEAM_COLOR_NAMES, maskAccountNumber } from '../types';
import * as storage from '../services/storage';
import { balanceTeams } from '../utils/teamBalancer';
import { Users, Trash2, Wallet, Hand, AlertTriangle, Edit2, Check, X, Loader2, Copy, ChevronDown, Shuffle, RefreshCw, Trophy, Pencil, Plus, Minus } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';

interface EventDetailProps {
  event: SportEvent;
  currentUser: User;
  bankAccounts: BankAccount[];
  sportConfigs: SportConfig[];
  allEvents: SportEvent[];
  onUpdate: (updatedEvent: SportEvent) => void;
  onDelete: (id: string) => void;
}

// Helper to calculate IBAN from Czech account format
export const convertToCZIBAN = (accountStr: string): string | null => {
  if (!accountStr) return null;
  const cleanStr = accountStr.replace(/\s/g, '');
  if (/^CZ\d{22}$/.test(cleanStr)) return cleanStr;
  const match = cleanStr.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!match) return null;
  const prefix = (match[1] || '').padStart(6, '0');
  const number = match[2].padStart(10, '0');
  const bankCode = match[3].padStart(4, '0');
  const bban = bankCode + prefix + number;
  const numericString = bban + '123500';
  let remainder = 0;
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
  }
  const checkDigits = (98 - remainder).toString().padStart(2, '0');
  return `CZ${checkDigits}${bban}`;
};

export const EventDetail: React.FC<EventDetailProps> = ({ event, currentUser, bankAccounts = [], sportConfigs = [], allEvents = [], onUpdate, onDelete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [savingUsers, setSavingUsers] = useState<Set<string>>(new Set());
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [tempTotalCost, setTempTotalCost] = useState(event.totalCost);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [editingTeamNameIdx, setEditingTeamNameIdx] = useState<0 | 1 | null>(null);
  const [tempTeamName, setTempTeamName] = useState('');
  const [setScores, setSetScores] = useState<[number, number][]>([]);
  const [isEditingScore, setIsEditingScore] = useState(false);

  /** Pick two random distinct team color names */
  const pickRandomTeamNames = (): [string, string] => {
    const shuffled = [...TEAM_COLOR_NAMES].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  };

  // Resolve sport config for this event
  const sportConfig = useMemo(() => {
    const type = event.sportType ?? 'volejbal';
    return sportConfigs.find(c => c.type === type) ?? { type: 'volejbal' as const, label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null };
  }, [event.sportType, sportConfigs]);

  // Determine the selected bank account
  const selectedBankAccount = useMemo(() => {
    if (event.selectedBankAccountId) {
      return bankAccounts.find(a => a.id === event.selectedBankAccountId) || null;
    }
    return null;
  }, [event.selectedBankAccountId, bankAccounts]);

  const effectiveAccountNumber = selectedBankAccount?.accountNumber || event.accountNumber || '';
  const selectedAccountOwner = selectedBankAccount?.ownerName || '';

  useEffect(() => {
    setTempTotalCost(event.totalCost);
    setIsEditingCost(false);
  }, [event.id, event.totalCost]);

  // Stable sort by name (Czech locale) so participant order never jumps on reload/sync
  const sortedParticipants = useMemo(
    () => [...event.participants].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    [event.participants]
  );

  const joinedParticipants = sortedParticipants.filter(p => p.status === 'joined');
  const waitlistedParticipants = sortedParticipants.filter(p => p.status === 'waitlist');

  /**
   * Incrementally update existing teams when participants join or leave.
   * - Removes team members who are no longer in the joined list.
   * - Adds new joined participants to the smaller team.
   * - Keeps existing assignments stable (no full re-shuffle).
   * Returns null if teams don't exist or there aren't enough players.
   */
  const updateTeamsForParticipantChange = (
    currentTeams: [TeamMember[], TeamMember[]] | undefined,
    newJoined: Participant[],
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

  const shuffleTeams = async () => {
    const teamSize = sportConfig.teamSize;

    // Use the balanced algorithm that considers player performance history
    const balanced = balanceTeams(joinedParticipants, allEvents, {
      teamSize,
    });

    let newTeams: [TeamMember[], TeamMember[]];
    if (balanced) {
      newTeams = balanced;
    } else {
      // Fallback: random split (shouldn't happen if canShuffleTeams is true)
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
    setSetScores([]);
    setIsEditingScore(false);
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

  // ── Score/set tracking handlers ──

  const handleAddSet = () => {
    setSetScores(prev => [...prev, [0, 0]]);
  };

  const handleRemoveSet = (idx: number) => {
    setSetScores(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSetScoreChange = (setIdx: number, teamIdx: 0 | 1, value: number) => {
    setSetScores(prev => prev.map((s, i) => {
      if (i !== setIdx) return s;
      const updated: [number, number] = [...s] as [number, number];
      updated[teamIdx] = value;
      return updated;
    }));
  };

  const handleSaveScore = () => {
    const validSets = setScores.filter(([a, b]) => a > 0 || b > 0);
    onUpdate({ ...event, score: validSets.length > 0 ? validSets : undefined });
    setIsEditingScore(false);
  };

  const handleCancelScore = () => {
    setSetScores(event.score ? [...event.score] : []);
    setIsEditingScore(false);
  };

  const handleStartEditScore = () => {
    setSetScores(event.score ? [...event.score] : [[0, 0]]);
    setIsEditingScore(true);
  };

  // Auto-generate teams on first load if none saved
  const countJoined = joinedParticipants.length;
  const costPerPerson = countJoined > 0 ? Math.ceil(event.totalCost / countJoined) : 0;
  const minPlayersForTeams = sportConfig.teamSize !== null ? sportConfig.teamSize * 2 : 2;
  const canShuffleTeams = countJoined >= minPlayersForTeams;
  const isAtCapacity = countJoined >= sportConfig.maxPlayers;

  useEffect(() => {
    if (!event.teams && joinedParticipants.length >= minPlayersForTeams) {
      // Auto-generate teams on first load if none saved and enough players
      shuffleTeams();
    } else if (event.teams) {
      // Teams exist — incrementally update to reflect participant changes
      const updatedTeams = updateTeamsForParticipantChange(event.teams, joinedParticipants);
      if (updatedTeams === null) {
        // Not enough players left for teams — clear them
        onUpdate({ ...event, teams: undefined, teamNames: undefined, winningTeam: undefined });
      } else {
        // Check if teams actually changed (avoid infinite loop)
        const currentIds = event.teams.flatMap(t => t.map(m => m.userId)).sort().join(',');
        const newIds = updatedTeams.flatMap(t => t.map(m => m.userId)).sort().join(',');
        if (currentIds !== newIds) {
          onUpdate({ ...event, teams: updatedTeams });
        }
      }
    }
  }, [event.id, joinedParticipants.length]);

  const currentUserParticipant = event.participants.find(p => p.userId === currentUser.id);
  const isCurrentUserJoined = currentUserParticipant?.status === 'joined';

  const iban = useMemo(() => convertToCZIBAN(effectiveAccountNumber), [effectiveAccountNumber]);
  const qrString = iban 
    ? `SPD*1.0*ACC:${iban}*AM:${costPerPerson}.00*CC:CZK*MSG:${sportConfig.label} ${event.date}`
    : null;

  const refreshEventData = async () => {
    setIsLoading(true);
    // In Firestore, we need to fetch all events again to get the updated state including new participants
    // Ideally we would fetch just this one event, but our storage abstraction is simple.
    // Let's rely on the parent's onUpdate to set the state, but we need to fetch the data first.
    const allEvents = await storage.getEvents();
    const refreshed = allEvents.find(e => e.id === event.id);
    if (refreshed) {
      onUpdate(refreshed);
    }
    setIsLoading(false);
  };

  // Helper to mark a user as saving / done saving
  const startSaving = (userId: string) => setSavingUsers(prev => new Set(prev).add(userId));
  const stopSaving = (userId: string) => setSavingUsers(prev => { const next = new Set(prev); next.delete(userId); return next; });

  const handleStatusChange = async (userId: string, status: Participant['status']) => {
    // Check capacity before allowing join — auto-waitlist when full
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

    // Build optimistic participants list
    let optimisticParticipants: Participant[];
    if (existing) {
      optimisticParticipants = prevParticipants.map(p =>
        p.userId === userId ? { ...p, status: effectiveStatus } : p
      );
    } else {
      // New participant (current user joining for the first time)
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
        // Persist promoted user's status change in background
        storage.updateAttendance(event.id, promoted.userId, 'joined').catch(() => {});
      }
    }

    // Optimistic UI update — also update teams to reflect participant change
    const optimisticJoined = optimisticParticipants.filter(p => p.status === 'joined');
    const updatedTeams = updateTeamsForParticipantChange(event.teams, optimisticJoined);
    const teamUpdates: Partial<SportEvent> = {};
    if (event.teams) {
      if (updatedTeams === null) {
        // Not enough players left — clear teams
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
      // Background sync to get authoritative state (e.g. other users' changes)
      const allEvents = await storage.getEvents();
      const refreshed = allEvents.find(e => e.id === event.id);
      if (refreshed) onUpdate(refreshed);
    } catch {
      // Rollback on error
      onUpdate({ ...event, participants: prevParticipants });
    } finally {
      stopSaving(userId);
    }
  };

  const handlePaymentToggle = async (userId: string, currentStatus: boolean) => {
    const participant = event.participants.find(p => p.userId === userId);
    if (!participant) return;

    const prevParticipants = event.participants;

    // Optimistic UI update — flip hasPaid immediately
    const optimisticParticipants = prevParticipants.map(p =>
      p.userId === userId ? { ...p, hasPaid: !currentStatus } : p
    );
    onUpdate({ ...event, participants: optimisticParticipants });
    startSaving(userId);

    try {
      await storage.updateAttendance(event.id, userId, participant.status, !currentStatus);
    } catch {
      // Rollback on error
      onUpdate({ ...event, participants: prevParticipants });
    } finally {
      stopSaving(userId);
    }
  };

  const handleBankAccountChange = (value: string) => {
    const selected = bankAccounts.find(a => a.id === value);
    if (selected) {
      const updatedEvent = { ...event, selectedBankAccountId: selected.id, accountNumber: selected.accountNumber };
      onUpdate(updatedEvent);
    }
  };

  const handleCopyToClipboard = async () => {
    if (effectiveAccountNumber) {
      try {
        await navigator.clipboard.writeText(effectiveAccountNumber);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleSaveCost = () => {
    const updatedEvent = { ...event, totalCost: tempTotalCost };
    onUpdate(updatedEvent);
    setIsEditingCost(false);
  };

  const handleCancelCostEdit = () => {
    setTempTotalCost(event.totalCost);
    setIsEditingCost(false);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Obrázek je příliš velký. Maximum je 2MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoBase64 = reader.result as string;

        // Upload photo via dedicated endpoint
        await storage.uploadUserPhoto(currentUser.id, photoBase64);

        // Refresh event data to get updated participant photos
        await refreshEventData();
        setIsUploadingPhoto(false);
      };
      reader.onerror = () => {
        setPhotoError('Chyba při načítání obrázku.');
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setPhotoError('Chyba při ukládání obrázku.');
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      await storage.deleteUserPhoto(currentUser.id);
      await refreshEventData();
      setIsUploadingPhoto(false);
    } catch (err) {
      setPhotoError('Chyba při mazání obrázku.');
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
           <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{event.title}</h2>
            <span className="text-base sm:text-lg text-slate-500 font-medium">
              {format(new Date(event.date), 'dd.MM.yyyy')}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-slate-500 mt-2 text-sm">
            <span className="flex items-center gap-1"><Users size={16} /> {event.location}</span>
            <div className="flex items-center gap-1">
              <Wallet size={16} />
              {!isEditingCost ? (
                <>
                  <span>Celkem: {event.totalCost} Kč</span>
                  <button
                    onClick={() => setIsEditingCost(true)}
                    className="ml-1 text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                    title="Upravit celkovou cenu"
                  >
                    <Edit2 size={12} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1">
                  <span>Celkem:</span>
                  <input
                    type="number"
                    value={tempTotalCost}
                    onChange={(e) => setTempTotalCost(Number(e.target.value))}
                    className="w-16 px-1 py-0.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 outline-none"
                    min="0"
                  />
                  <span>Kč</span>
                  <button onClick={handleSaveCost} className="text-green-600 hover:bg-green-50 p-0.5 rounded transition-colors">
                    <Check size={14}/>
                  </button>
                  <button onClick={handleCancelCostEdit} className="text-red-600 hover:bg-red-50 p-0.5 rounded transition-colors">
                    <X size={14}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <button 
          onClick={() => onDelete(event.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
          title="Smazat událost"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid lg:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Left Column: Participants */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                Účastníci ({countJoined}/{sportConfig.maxPlayers})
                {isAtCapacity && (
                  <span className="text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Plná kapacita</span>
                )}
              </span>
              <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {costPerPerson} Kč / os.
              </span>
            </h3>

            {/* Photo Error Message */}
            {photoError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {photoError}
              </div>
            )}

            {/* Capacity Error Message */}
            {capacityError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {capacityError}
              </div>
            )}

            {/* Quick Join Button for Current User */}
            {!isCurrentUserJoined && currentUserParticipant?.status !== 'waitlist' && (
              <button
                onClick={() => handleStatusChange(currentUser.id, 'joined')}
                disabled={savingUsers.has(currentUser.id)}
                className={`w-full mb-4 py-3 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
                  isAtCapacity
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                {savingUsers.has(currentUser.id) ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Hand size={20} />
                )}
                {isAtCapacity ? 'Na čekací listinu' : 'Jdu hrát'}
              </button>
            )}

            <div className="space-y-2">
              {sortedParticipants
                .filter(p => p.status !== 'declined' || p.userId === currentUser.id)
                .map(p => {
                const isMe = p.userId === currentUser.id;
                const isSaving = savingUsers.has(p.userId);

                return (
                  <div key={p.userId} className={`flex items-center justify-between p-2 border rounded-lg shadow-sm hover:shadow-md transition-shadow group ${isMe ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${
                        p.status === 'joined' ? 'bg-green-500' : 
                        p.status === 'declined' ? 'bg-red-500' : 
                        p.status === 'waitlist' ? 'bg-amber-500' : 'bg-yellow-400'
                      }`}></div>

                      {/* Photo with upload option for current user */}
                      {isMe ? (
                        <div className="relative group/photo">
                          <label className="cursor-pointer block">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              disabled={isUploadingPhoto}
                              className="hidden"
                            />
                            {p.photoUrl ? (
                              <img
                                src={p.photoUrl}
                                alt={p.name}
                                className="w-8 h-8 rounded-full object-cover border-2 border-blue-400 hover:border-blue-500 transition-colors"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm border-2 border-blue-400 hover:border-blue-500 transition-colors">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {isUploadingPhoto && (
                              <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin text-blue-600" />
                              </div>
                            )}
                          </label>
                          {p.photoUrl && !isUploadingPhoto && (
                            <button
                              onClick={handleRemovePhoto}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/photo:opacity-100 transition-opacity"
                              title="Odebrat fotku"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover border-2 border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm border-2 border-slate-200">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <p className={`font-medium text-sm ${isMe ? 'text-blue-800' : 'text-slate-800'}`}>
                          {p.name} {isMe && '(Já)'}
                        </p>
                        
                        {/* Status Controls - Only visible for current user */}
                        {isMe ? (
                          <div className="flex gap-2 text-xs mt-0.5">
                            <button 
                              disabled={isSaving}
                              onClick={() => handleStatusChange(p.userId, 'joined')}
                              className={`hover:underline ${p.status === 'joined' ? 'font-bold text-green-600' : 'text-slate-400'}`}
                            >Jdu</button>
                             <span className="text-slate-300">|</span>
                            <button 
                              disabled={isSaving}
                              onClick={() => handleStatusChange(p.userId, 'declined')}
                              className={`hover:underline ${p.status === 'declined' ? 'font-bold text-red-600' : 'text-slate-400'}`}
                            >Nejdu</button>
                          </div>
                        ) : (
                          // Read-only status for others
                          <div className="text-xs mt-0.5 font-medium text-slate-500 flex items-center gap-1">
                            {p.status === 'joined' ? 'Jde hrát' : p.status === 'declined' ? 'Nejde' : p.status === 'waitlist' ? 'Čeká na místo' : 'Možná'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.status === 'joined' && (
                        <label className="flex items-center gap-2 cursor-pointer select-none group/checkbox p-1 rounded hover:bg-slate-50 transition-colors">
                           <span className="w-4 h-4 flex items-center justify-center shrink-0">
                             {isSaving ? (
                               <Loader2 size={16} className="animate-spin text-blue-500" />
                             ) : (
                               <input
                                 type="checkbox"
                                 checked={p.hasPaid}
                                 onChange={() => handlePaymentToggle(p.userId, p.hasPaid)}
                                 className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                               />
                             )}
                           </span>
                           <span className={`text-xs w-[4.5rem] ${p.hasPaid ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                             {p.hasPaid ? 'Zaplaceno' : 'Nezaplaceno'}
                           </span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}

              {sortedParticipants.length === 0 && (
                <p className="text-center text-slate-400 py-4 italic">Zatím žádní účastníci.</p>
              )}
            </div>

            {/* Waitlist Section */}
            {waitlistedParticipants.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3" data-testid="waitlist-section">
                <h4 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                  <Users size={14} />
                  Čekací listina ({waitlistedParticipants.length})
                </h4>
                <div className="space-y-1.5">
                  {waitlistedParticipants.map((p, idx) => (
                    <div key={p.userId} className="flex items-center gap-2 text-sm text-amber-800">
                      <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{p.name}</span>
                      {p.userId === currentUser.id && (
                        <span className="text-xs text-amber-600">(Já)</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2 italic">
                  Automaticky zařazeni při uvolnění místa.
                </p>
              </div>
            )}
          </div>

          {/* Team Split */}
          {event.teams && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                  <Shuffle size={18} className="text-indigo-500" />
                  Rozdělení do týmů
                  {(event.gameHistory?.length || 0) > 0 && (
                    <span className="text-xs font-normal text-slate-400">
                      Hra {(event.gameHistory?.length || 0) + 1}
                    </span>
                  )}
                </h3>
                <button
                  onClick={shuffleTeams}
                  disabled={!canShuffleTeams}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} />
                  {event.winningTeam !== undefined ? 'Nová hra' : 'Zamíchat'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {event.teams.map((team, teamIdx) => {
                  const isWinner = event.winningTeam === teamIdx;
                  const teamName = event.teamNames?.[teamIdx] ?? `Tým ${teamIdx + 1}`;
                  const isEditingThisTeam = editingTeamNameIdx === teamIdx;
                  return (
                    <div key={teamIdx} className={`rounded-lg border-2 p-3 transition-all ${
                      isWinner
                        ? 'bg-green-50 border-green-400 ring-1 ring-green-200'
                        : teamIdx === 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                    }`}>
                      <h4 className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${
                        isWinner ? 'text-green-700' : teamIdx === 0 ? 'text-blue-700' : 'text-orange-700'
                      }`}>
                        {isWinner && <Trophy size={14} />}
                        {isEditingThisTeam ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tempTeamName}
                              onChange={e => setTempTeamName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveTeamName(); if (e.key === 'Escape') handleCancelEditTeamName(); }}
                              className="w-24 px-1.5 py-0.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 outline-none bg-white"
                              autoFocus
                              data-testid={`team-name-input-${teamIdx}`}
                            />
                            <button onClick={handleSaveTeamName} className="text-green-600 hover:bg-green-50 p-0.5 rounded" data-testid={`team-name-save-${teamIdx}`}>
                              <Check size={12} />
                            </button>
                            <button onClick={handleCancelEditTeamName} className="text-red-500 hover:bg-red-50 p-0.5 rounded" data-testid={`team-name-cancel-${teamIdx}`}>
                              <X size={12} />
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 group/teamname">
                            {teamName} ({team.length})
                            <button
                              onClick={() => handleStartEditTeamName(teamIdx as 0 | 1)}
                              className="opacity-0 group-hover/teamname:opacity-100 text-slate-400 hover:text-blue-600 p-0.5 rounded transition-opacity"
                              title="Přejmenovat tým"
                              data-testid={`team-name-edit-${teamIdx}`}
                            >
                              <Pencil size={10} />
                            </button>
                          </span>
                        )}
                        {isWinner && !isEditingThisTeam && <span className="text-xs font-normal ml-1">— Výherce</span>}
                      </h4>
                      <div className="space-y-1.5">
                        {team.map(p => (
                          <div key={p.userId} className="flex items-center gap-2">
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm text-slate-700">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Winner buttons — only show when no winner yet */}
              {event.winningTeam === undefined && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[0, 1].map(idx => {
                    const btnTeamName = event.teamNames?.[idx] ?? `Tým ${idx + 1}`;
                    return (
                      <button
                        key={idx}
                        onClick={() => setWinner(idx as 0 | 1)}
                        className="py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200"
                        data-testid={`winner-btn-${idx}`}
                      >
                        <Trophy size={14} />
                        {btnTeamName} vyhrál
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Score tracking — show below teams when they exist */}
              {event.teams && (
                <div className="mt-3 bg-slate-50 rounded-lg border border-slate-200 p-3" data-testid="score-section">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Skóre setů
                    </h4>
                    {!isEditingScore ? (
                      <button
                        onClick={handleStartEditScore}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                        data-testid="score-edit-btn"
                      >
                        <Edit2 size={12} />
                        {event.score ? 'Upravit' : 'Zadat skóre'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleSaveScore}
                          className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors"
                          data-testid="score-save-btn"
                        >
                          <Check size={12} />
                          Uložit
                        </button>
                        <button
                          onClick={handleCancelScore}
                          className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors"
                          data-testid="score-cancel-btn"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingScore ? (
                    <div className="space-y-2">
                      {/* Team name headers */}
                      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center text-xs text-slate-500 font-medium">
                        <span className="w-12"></span>
                        <span className="text-center truncate">{event.teamNames?.[0] ?? 'Tým 1'}</span>
                        <span></span>
                        <span className="text-center truncate">{event.teamNames?.[1] ?? 'Tým 2'}</span>
                        <span className="w-6"></span>
                      </div>
                      {setScores.map(([s0, s1], idx) => (
                        <div key={idx} className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center" data-testid={`score-set-${idx}`}>
                          <span className="text-xs font-bold text-slate-400 w-12">Set {idx + 1}</span>
                          <input
                            type="number"
                            min="0"
                            value={s0}
                            onChange={e => handleSetScoreChange(idx, 0, Math.max(0, Number(e.target.value)))}
                            className="w-full px-2 py-1.5 text-sm text-center border border-slate-300 rounded focus:ring-1 focus:ring-blue-300 outline-none"
                            data-testid={`score-set-${idx}-team-0`}
                          />
                          <span className="text-xs text-slate-300 font-bold">:</span>
                          <input
                            type="number"
                            min="0"
                            value={s1}
                            onChange={e => handleSetScoreChange(idx, 1, Math.max(0, Number(e.target.value)))}
                            className="w-full px-2 py-1.5 text-sm text-center border border-slate-300 rounded focus:ring-1 focus:ring-blue-300 outline-none"
                            data-testid={`score-set-${idx}-team-1`}
                          />
                          <button
                            onClick={() => handleRemoveSet(idx)}
                            className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"
                            title="Odebrat set"
                            data-testid={`score-remove-set-${idx}`}
                          >
                            <Minus size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={handleAddSet}
                        className="w-full py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-1 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                        data-testid="score-add-set-btn"
                      >
                        <Plus size={12} />
                        Přidat set
                      </button>
                    </div>
                  ) : event.score && event.score.length > 0 ? (
                    <div className="space-y-1.5">
                      {/* Read-only score display */}
                      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-xs text-slate-500 font-medium">
                        <span className="w-12"></span>
                        <span className="text-center truncate">{event.teamNames?.[0] ?? 'Tým 1'}</span>
                        <span></span>
                        <span className="text-center truncate">{event.teamNames?.[1] ?? 'Tým 2'}</span>
                      </div>
                      {event.score.map(([s0, s1], idx) => (
                        <div key={idx} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center" data-testid={`score-display-set-${idx}`}>
                          <span className="text-xs font-bold text-slate-400 w-12">Set {idx + 1}</span>
                          <span className={`text-sm text-center font-mono font-semibold ${s0 > s1 ? 'text-green-600' : 'text-slate-600'}`}>{s0}</span>
                          <span className="text-xs text-slate-300 font-bold">:</span>
                          <span className={`text-sm text-center font-mono font-semibold ${s1 > s0 ? 'text-green-600' : 'text-slate-600'}`}>{s1}</span>
                        </div>
                      ))}
                      {/* Set tally */}
                      {(() => {
                        const won0 = event.score.filter(([a, b]) => a > b).length;
                        const won1 = event.score.filter(([a, b]) => b > a).length;
                        return (
                          <div className="pt-1.5 border-t border-slate-200 flex justify-center gap-2 text-xs font-semibold">
                            <span className={won0 > won1 ? 'text-green-600' : 'text-slate-500'}>{won0}</span>
                            <span className="text-slate-300">:</span>
                            <span className={won1 > won0 ? 'text-green-600' : 'text-slate-500'}>{won1}</span>
                            <span className="text-slate-400 font-normal ml-1">na sety</span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-1">
                      Zatím žádné skóre.
                    </p>
                  )}
                </div>
              )}

              {/* Winner announced — prompt for new game */}
              {event.winningTeam !== undefined && (
                <div className="mt-3 text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1.5">
                  <Trophy size={14} />
                  {event.teamNames?.[event.winningTeam] ?? `Tým ${event.winningTeam + 1}`} vyhrál! Klikněte „Nová hra" pro další kolo.
                </div>
              )}

              {/* Game History */}
              {event.gameHistory && event.gameHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Předchozí hry ({event.gameHistory.length})
                  </h4>
                  <div className="space-y-2">
                    {[...event.gameHistory].reverse().map((round, idx) => {
                      const roundNum = event.gameHistory!.length - idx;
                      const name0 = round.teamNames?.[0] ?? round.teams[0].map(p => p.name.split(' ')[0]).join(', ');
                      const name1 = round.teamNames?.[1] ?? round.teams[1].map(p => p.name.split(' ')[0]).join(', ');
                      const tooltip0 = round.teams[0].map(p => p.name).join(', ');
                      const tooltip1 = round.teams[1].map(p => p.name).join(', ');
                      const scoreStr = round.score && round.score.length > 0
                        ? round.score.map(([a, b]) => `${a}:${b}`).join(', ')
                        : null;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2" data-testid={`game-history-${roundNum}`}>
                          <span className="font-bold text-slate-400 w-6 shrink-0">#{roundNum}</span>
                          <div className="flex-1 flex items-center gap-1.5 min-w-0">
                            <span
                              className={`font-medium truncate ${round.winningTeam === 0 ? 'text-green-600' : 'text-slate-500'}`}
                              title={tooltip0}
                            >
                              {round.winningTeam === 0 && '🏆 '}
                              {name0}
                            </span>
                            <span className="text-slate-300 font-bold shrink-0">vs</span>
                            <span
                              className={`font-medium truncate ${round.winningTeam === 1 ? 'text-green-600' : 'text-slate-500'}`}
                              title={tooltip1}
                            >
                              {round.winningTeam === 1 && '🏆 '}
                              {name1}
                            </span>
                            {scoreStr && (
                              <span className="text-slate-400 font-mono ml-1 shrink-0" title="Skóre setů">
                                ({scoreStr})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Payment Info */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-fit">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-blue-600"/> 
            Platební údaje
          </h3>
          
          <div className="space-y-4">
            {/* Bank Account Selector */}
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Bankovní účet</p>
              
              {bankAccounts.length > 0 ? (
                <div className="relative">
                  <select
                    value={event.selectedBankAccountId || ''}
                    onChange={(e) => handleBankAccountChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none pr-8 cursor-pointer"
                  >
                    <option value="" disabled>Vyberte účet...</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.ownerName} — {maskAccountNumber(a.accountNumber)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  Žádné účty. Přidejte si účet v nastavení (⚙️).
                </p>
              )}

              {/* Display effective account info */}
              {effectiveAccountNumber && (
                <div className="mt-3 flex items-center gap-2">
                  {selectedAccountOwner && (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedAccountOwner}
                    </span>
                  )}
                  <p className="text-sm font-mono text-slate-700 tracking-wider select-all truncate flex-1">
                    {maskAccountNumber(effectiveAccountNumber)}
                  </p>
                  <button
                    onClick={handleCopyToClipboard}
                    className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors flex-shrink-0"
                    title="Zkopírovat číslo účtu"
                  >
                    {isCopied ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              )}

              {effectiveAccountNumber && !iban && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> Neplatný formát pro QR platbu
                </p>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Částka na osobu</p>
              <p className="text-3xl font-bold text-blue-600">{costPerPerson} Kč</p>
            </div>

            {countJoined > 0 && effectiveAccountNumber && qrString && (
              <div className="flex flex-col items-center bg-white p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500 mb-3">QR Platba</p>
                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                  <QRCode 
                    value={qrString}
                    size={160}
                    level="M"
                    viewBox={`0 0 256 256`}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center max-w-[200px]">
                  Naskenujte ve svém bankovnictví
                </p>
              </div>
            )}
            
            {(!countJoined || !effectiveAccountNumber || (effectiveAccountNumber && !qrString)) && (
               <div className="text-center p-4 text-slate-400 text-sm italic">
                 {!countJoined ? "Přidejte účastníky pro výpočet ceny." : 
                  !effectiveAccountNumber ? "Vyberte bankovní účet." : 
                  "Nelze vygenerovat QR kód (chybné číslo účtu)."}
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};


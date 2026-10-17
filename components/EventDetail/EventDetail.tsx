import React, { useMemo, useState, useEffect } from 'react';
import { SportEvent, User, BankAccount, SportConfig } from '@/types.ts';
import { convertToCZIBAN } from '@/utils/iban.ts';
import { Loader2 } from 'lucide-react';

import { useTeamManagement } from './hooks/useTeamManagement';
import { useScoreTracking } from './hooks/useScoreTracking';
import { useParticipants } from './hooks/useParticipants';
import { usePhotoUpload } from './hooks/usePhotoUpload';

import { EventDetailHeader } from './EventDetailHeader';
import { ParticipantList } from './ParticipantList';
import { WaitlistSection } from './WaitlistSection';
import { TeamSection } from './TeamSection';
import { PaymentSection } from './PaymentSection';
import { EventAwardsSection } from './EventAwardsSection';
import { PublicPlayerModal } from '../PlayerDashboard/PublicPlayerModal';
import { computePlayerGamification } from '@/services/gamificationEngine';
import { ErrorBoundary } from '../ErrorBoundary';

interface EventDetailProps {
  event: SportEvent;
  currentUser: User;
  bankAccounts: BankAccount[];
  sportConfigs: SportConfig[];
  allEvents: SportEvent[];
  allUsers?: User[];
  onUpdate: (updatedEvent: SportEvent) => void;
  onDelete: (id: string) => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({
  event,
  currentUser,
  bankAccounts = [],
  sportConfigs = [],
  allEvents = [],
  allUsers = [],
  onUpdate,
  onDelete,
}) => {
  // ── Cost, location & time editing state (small enough to stay inline) ──
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [tempTotalCost, setTempTotalCost] = useState(String(event.totalCost));
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocation, setTempLocation] = useState(event.location);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [tempTime, setTempTime] = useState(event.time);
  const [isCopied, setIsCopied] = useState(false);
  const [inspectingUserId, setInspectingUserId] = useState<string | null>(null);

  useEffect(() => {
    setTempTotalCost(String(event.totalCost));
    setIsEditingCost(false);
    setTempLocation(event.location);
    setIsEditingLocation(false);
    setTempTime(event.time);
    setIsEditingTime(false);
  }, [event.id, event.totalCost, event.location, event.time]);

  // ── Resolve sport config ──
  const sportConfig = useMemo(() => {
    const type = event.sportType ?? 'volejbal';
    return sportConfigs.find(c => c.type === type) ?? {
      type: 'volejbal' as const, label: 'Volejbal', maxPlayers: 12,
      defaultCost: 1000, defaultLocation: 'Hala', teamSize: null,
    };
  }, [event.sportType, sportConfigs]);

  // ── Derived participant data ──
  const sortedParticipants = useMemo(
    () => {
      const safe = Array.isArray(event.participants) ? event.participants : [];
      return [...safe].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'cs'));
    },
    [event.participants],
  );
  const joinedParticipants = sortedParticipants.filter(p => p.status === 'joined');
  const waitlistedParticipants = sortedParticipants.filter(p => p.status === 'waitlist');
  const countJoined = joinedParticipants.length;
  const costPerPerson = countJoined > 0 ? Math.ceil(event.totalCost / countJoined) : 0;
  const isAtCapacity = countJoined >= sportConfig.maxPlayers;
  const isPastEvent = new Date(event.date + 'T23:59:59') < new Date();

  // ── Bank account / QR derived data ──
  const selectedBankAccount = useMemo(() => {
    if (event.selectedBankAccountId) {
      return bankAccounts.find(a => a.id === event.selectedBankAccountId) || null;
    }
    return null;
  }, [event.selectedBankAccountId, bankAccounts]);

  const effectiveAccountNumber = selectedBankAccount?.accountNumber || event.accountNumber || '';
  const selectedAccountOwner = selectedBankAccount?.ownerName || '';
  const iban = useMemo(() => convertToCZIBAN(effectiveAccountNumber), [effectiveAccountNumber]);
  const qrString = iban
    ? `SPD*1.0*ACC:${iban}*AM:${costPerPerson}.00*CC:CZK*MSG:${sportConfig.label} ${event.date}`
    : null;

  // ── Hooks ──
  const scoreTracking = useScoreTracking({ event, onUpdate });

  const teamManagement = useTeamManagement({
    event,
    joinedParticipants,
    sportConfig,
    allEvents,
    onUpdate,
    onScoreReset: scoreTracking.resetScores,
  });

  const participants = useParticipants({ event, currentUser, sportConfig, onUpdate });

  const photoUpload = usePhotoUpload({
    currentUser,
    refreshEventData: participants.refreshEventData,
  });

  // ── Cost handlers ──
  const handleSaveCost = () => {
    onUpdate({ ...event, totalCost: Number(tempTotalCost) || 0 });
    setIsEditingCost(false);
  };

  const handleCancelCostEdit = () => {
    setTempTotalCost(String(event.totalCost));
    setIsEditingCost(false);
  };

  // ── Location handlers ──
  const handleSaveLocation = () => {
    const trimmed = tempLocation.trim();
    if (trimmed) {
      onUpdate({ ...event, location: trimmed });
    }
    setIsEditingLocation(false);
  };

  const handleCancelLocationEdit = () => {
    setTempLocation(event.location);
    setIsEditingLocation(false);
  };

  // ── Time handlers ──
  const handleSaveTime = () => {
    const trimmed = tempTime.trim();
    if (trimmed && trimmed !== event.time) {
      onUpdate({ ...event, time: trimmed });
    }
    setIsEditingTime(false);
  };

  const handleCancelTimeEdit = () => {
    setTempTime(event.time);
    setIsEditingTime(false);
  };

  const handleBankAccountChange = (value: string) => {
    const selected = bankAccounts.find(a => a.id === value);
    if (selected) {
      onUpdate({ ...event, selectedBankAccountId: selected.id, accountNumber: selected.accountNumber });
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

  // ── Multisport card holders among joined participants ──
  const multisportUsers = useMemo(() => {
    return joinedParticipants
      .filter(p => {
        const user = allUsers.find(u => u.id === p.userId);
        return user?.hasMultisportCard === true;
      })
      .map(p => ({ name: p.name }));
  }, [joinedParticipants, allUsers]);

  // ── Inspected player for Public Profile Modal ──
  const inspectingUser = useMemo(() => {
    if (!inspectingUserId) return null;
    const found = allUsers.find(u => u.id === inspectingUserId);
    if (found) return found;
    const part = event.participants?.find(p => p.userId === inspectingUserId);
    if (part) {
      return {
        id: part.userId,
        name: part.name,
        photoUrl: part.photoUrl,
      } as User;
    }
    return null;
  }, [inspectingUserId, allUsers, event.participants]);

  const inspectingGamification = useMemo(() => {
    if (!inspectingUser) return null;
    const allTeamUserIds = allUsers.map(u => u.id);
    return computePlayerGamification(allEvents, inspectingUser.id, inspectingUser, allTeamUserIds);
  }, [inspectingUser, allEvents, allUsers]);

  return (
    <div className="bg-white md:rounded-2xl shadow-none md:shadow-lg border-0 md:border md:border-slate-200 overflow-hidden flex flex-col h-full relative">
      {participants.isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

      <ErrorBoundary fallbackMessage="Chyba v hlavičce">
        <EventDetailHeader
          event={event}
          sportConfig={sportConfig}
          countJoined={countJoined}
          costPerPerson={costPerPerson}
          isEditingCost={isEditingCost}
          tempTotalCost={tempTotalCost}
          onTempTotalCostChange={setTempTotalCost}
          onStartEditCost={() => setIsEditingCost(true)}
          onSaveCost={handleSaveCost}
          onCancelCostEdit={handleCancelCostEdit}
          isEditingTime={isEditingTime}
          tempTime={tempTime}
          onTempTimeChange={setTempTime}
          onStartEditTime={() => setIsEditingTime(true)}
          onSaveTime={handleSaveTime}
          onCancelTimeEdit={handleCancelTimeEdit}
          isEditingLocation={isEditingLocation}
          tempLocation={tempLocation}
          onTempLocationChange={setTempLocation}
          onStartEditLocation={() => setIsEditingLocation(true)}
          onSaveLocation={handleSaveLocation}
          onCancelLocationEdit={handleCancelLocationEdit}
          onDelete={onDelete}
        />
      </ErrorBoundary>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 grid lg:grid-cols-2 gap-6 lg:gap-8 overscroll-contain custom-scrollbar">
        {/* Left Column: Participants & Teams */}
        <div className="space-y-6">
          <ErrorBoundary fallbackMessage="Chyba v seznamu účastníků">
            <ParticipantList
              sortedParticipants={sortedParticipants}
              currentUser={currentUser}
              sportConfig={sportConfig}
              countJoined={countJoined}
              costPerPerson={costPerPerson}
              isAtCapacity={isAtCapacity}
              isPastEvent={isPastEvent}
              participants={participants}
              photoUpload={photoUpload}
              onSelectUser={setInspectingUserId}
            />
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="Chyba v čekací listině">
            <WaitlistSection
              waitlistedParticipants={waitlistedParticipants}
              currentUser={currentUser}
            />
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="Chyba v sekci týmů">
            <TeamSection
              event={event}
              teamManagement={teamManagement}
              scoreTracking={scoreTracking}
              onSelectUser={setInspectingUserId}
            />
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="Chyba v ocenění zápasu">
            <EventAwardsSection
              event={event}
              allUsers={allUsers}
              onUpdate={onUpdate}
            />
          </ErrorBoundary>
        </div>

        {/* Right Column: Payment Info */}
        <ErrorBoundary fallbackMessage="Chyba v platebních údajích">
          <PaymentSection
            event={event}
            bankAccounts={bankAccounts}
            effectiveAccountNumber={effectiveAccountNumber}
            selectedAccountOwner={selectedAccountOwner}
            iban={iban}
            qrString={qrString}
            costPerPerson={costPerPerson}
            countJoined={countJoined}
            isCopied={isCopied}
            onCopyToClipboard={handleCopyToClipboard}
            onBankAccountChange={handleBankAccountChange}
            multisportUsers={multisportUsers}
          />
        </ErrorBoundary>
      </div>

      {/* Public Player Profile Modal */}
      {inspectingUser && inspectingGamification && (
        <PublicPlayerModal
          user={inspectingUser}
          gamification={inspectingGamification}
          onClose={() => setInspectingUserId(null)}
        />
      )}
    </div>
  );
};


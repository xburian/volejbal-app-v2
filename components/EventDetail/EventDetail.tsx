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
import { EventBottomActionDock } from './EventBottomActionDock';
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

  // ── Mobile Tab State ──
  const [activeTab, setActiveTab] = useState<'roster' | 'game' | 'payment'>('roster');

  // ── Action Dock Handlers ──
  const isWaitlisted = waitlistedParticipants.some(p => p.userId === currentUser.id);

  const handleJoinOrWaitlist = () => {
    participants.handleStatusChange(currentUser.id, 'joined');
  };

  const handleDecline = () => {
    participants.handleStatusChange(currentUser.id, 'declined');
  };

  const handleGoToPayment = () => {
    setActiveTab('payment');
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Fallback for environments lacking smooth scroll support
      }
    }
  };

  return (
    <div className="bg-white md:rounded-2xl shadow-none md:shadow-lg border-0 md:border md:border-slate-200 md:overflow-hidden flex flex-col md:h-full relative pb-28 md:pb-0">
      {participants.isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Header is inside the scrollable document flow on mobile */}
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

      {/* Mobile Segmented Control */}
      <div className="md:hidden px-4 pt-3 pb-2" data-testid="event-detail-mobile-tabs">
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
          <button
            type="button"
            data-testid="tab-roster"
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Účastníci ({countJoined})
          </button>
          <button
            type="button"
            data-testid="tab-game"
            onClick={() => setActiveTab('game')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
              activeTab === 'game'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Týmy & Skóre
          </button>
          <button
            type="button"
            data-testid="tab-payment"
            onClick={() => setActiveTab('payment')}
            className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
              activeTab === 'payment'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Platba ({costPerPerson} Kč)
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 md:p-6 md:flex-1 md:overflow-y-auto pb-6 overscroll-contain custom-scrollbar">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column: Participants & Teams */}
          <div className="flex flex-col gap-6">
            <div className={activeTab === 'roster' ? 'flex flex-col gap-6' : 'hidden md:flex md:flex-col md:gap-6'}>
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
                />
              </ErrorBoundary>

              <ErrorBoundary fallbackMessage="Chyba v čekací listině">
                <WaitlistSection
                  waitlistedParticipants={waitlistedParticipants}
                  currentUser={currentUser}
                />
              </ErrorBoundary>
            </div>

            <div className={activeTab === 'game' ? 'flex flex-col gap-6' : 'hidden md:flex md:flex-col md:gap-6'}>
              <ErrorBoundary fallbackMessage="Chyba v sekci týmů">
                <TeamSection
                  event={event}
                  teamManagement={teamManagement}
                  scoreTracking={scoreTracking}
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
          </div>

          {/* Right Column: Payment Info */}
          <div className={activeTab === 'payment' ? 'block' : 'hidden md:block'}>
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
        </div>
      </div>

      {/* Floating Action Dock for Mobile */}
      <EventBottomActionDock
        isCurrentUserJoined={participants.isCurrentUserJoined}
        isWaitlisted={isWaitlisted}
        isAtCapacity={isAtCapacity}
        countJoined={countJoined}
        maxPlayers={sportConfig.maxPlayers}
        costPerPerson={costPerPerson}
        hasPaid={participants.currentUserParticipant?.hasPaid ?? false}
        isSaving={participants.savingUsers.has(currentUser.id)}
        onJoinOrWaitlist={handleJoinOrWaitlist}
        onDecline={handleDecline}
        onGoToPayment={handleGoToPayment}
      />
    </div>
  );
};


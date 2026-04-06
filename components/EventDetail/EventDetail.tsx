import React, { useMemo, useState, useEffect } from 'react';
import { SportEvent, User, BankAccount, SportConfig } from '../../types';
import { convertToCZIBAN } from '../../utils/iban';
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

interface EventDetailProps {
  event: SportEvent;
  currentUser: User;
  bankAccounts: BankAccount[];
  sportConfigs: SportConfig[];
  allEvents: SportEvent[];
  onUpdate: (updatedEvent: SportEvent) => void;
  onDelete: (id: string) => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({
  event,
  currentUser,
  bankAccounts = [],
  sportConfigs = [],
  allEvents = [],
  onUpdate,
  onDelete,
}) => {
  // ── Cost editing state (small enough to stay inline) ──
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [tempTotalCost, setTempTotalCost] = useState(event.totalCost);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setTempTotalCost(event.totalCost);
    setIsEditingCost(false);
  }, [event.id, event.totalCost]);

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
    () => [...event.participants].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    [event.participants],
  );
  const joinedParticipants = sortedParticipants.filter(p => p.status === 'joined');
  const waitlistedParticipants = sortedParticipants.filter(p => p.status === 'waitlist');
  const countJoined = joinedParticipants.length;
  const costPerPerson = countJoined > 0 ? Math.ceil(event.totalCost / countJoined) : 0;
  const isAtCapacity = countJoined >= sportConfig.maxPlayers;

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
    onUpdate({ ...event, totalCost: tempTotalCost });
    setIsEditingCost(false);
  };

  const handleCancelCostEdit = () => {
    setTempTotalCost(event.totalCost);
    setIsEditingCost(false);
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

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full relative">
      {participants.isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

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
        onDelete={onDelete}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column: Participants & Teams */}
        <div className="space-y-6">
          <ParticipantList
            sortedParticipants={sortedParticipants}
            currentUser={currentUser}
            sportConfig={sportConfig}
            countJoined={countJoined}
            costPerPerson={costPerPerson}
            isAtCapacity={isAtCapacity}
            isCurrentUserJoined={participants.isCurrentUserJoined}
            currentUserParticipant={participants.currentUserParticipant}
            savingUsers={participants.savingUsers}
            capacityError={participants.capacityError}
            photoError={photoUpload.photoError}
            isUploadingPhoto={photoUpload.isUploadingPhoto}
            onStatusChange={participants.handleStatusChange}
            onPaymentToggle={participants.handlePaymentToggle}
            onPhotoChange={photoUpload.handlePhotoChange}
            onRemovePhoto={photoUpload.handleRemovePhoto}
          />

          <WaitlistSection
            waitlistedParticipants={waitlistedParticipants}
            currentUser={currentUser}
          />

          <TeamSection
            event={event}
            canShuffleTeams={teamManagement.canShuffleTeams}
            onShuffleTeams={teamManagement.shuffleTeams}
            onSetWinner={teamManagement.setWinner}
            editingTeamNameIdx={teamManagement.editingTeamNameIdx}
            tempTeamName={teamManagement.tempTeamName}
            onTempTeamNameChange={teamManagement.setTempTeamName}
            onStartEditTeamName={teamManagement.handleStartEditTeamName}
            onSaveTeamName={teamManagement.handleSaveTeamName}
            onCancelEditTeamName={teamManagement.handleCancelEditTeamName}
            setScores={scoreTracking.setScores}
            isEditingScore={scoreTracking.isEditingScore}
            onAddSet={scoreTracking.handleAddSet}
            onRemoveSet={scoreTracking.handleRemoveSet}
            onSetScoreChange={scoreTracking.handleSetScoreChange}
            onSaveScore={scoreTracking.handleSaveScore}
            onCancelScore={scoreTracking.handleCancelScore}
            onStartEditScore={scoreTracking.handleStartEditScore}
          />
        </div>

        {/* Right Column: Payment Info */}
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
        />
      </div>
    </div>
  );
};


import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SportEvent, User, BankAccount, SportConfig, SPORT_EMOJI } from '@/types.ts';
import { convertToCZIBAN } from '@/utils/iban.ts';
import { Loader2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

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
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);

  useEffect(() => {
    setTempTotalCost(String(event.totalCost));
    setIsEditingCost(false);
    setTempLocation(event.location);
    setIsEditingLocation(false);
    setTempTime(event.time);
    setIsEditingTime(false);
    setIsHeaderExpanded(false);
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

  // ── Formatted event date for collapsible mobile banner ──
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(event.date + 'T00:00:00');
      const raw = format(d, 'EEE d. M.', { locale: cs });
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
      return event.date;
    }
  }, [event.date]);

  // ── Mobile Tab & Swipe Navigation State ──
  const [activeTab, setActiveTab] = useState<'roster' | 'game' | 'payment'>('roster');
  const TABS: Array<'roster' | 'game' | 'payment'> = ['roster', 'game', 'payment'];
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    // Don't trigger swipe if touch originated in horizontally scrollable regions or form inputs
    if (target?.closest('.overflow-x-auto, input, select, textarea, [data-no-swipe]')) {
      touchStartX.current = 0;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === 0) return;
    if (e.changedTouches.length !== 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;

    touchStartX.current = 0;

    // Must be predominantly horizontal gesture: min 45px, dx > 1.5 * dy, within 600ms
    if (Math.abs(deltaX) >= 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && elapsed < 600) {
      const currentIndex = TABS.indexOf(activeTab);
      if (deltaX < 0 && currentIndex < TABS.length - 1) {
        // Swipe left -> advance to next tab
        setActiveTab(TABS[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        // Swipe right -> retreat to previous tab
        setActiveTab(TABS[currentIndex - 1]);
      }
    }
  };

  const handleTouchCancel = () => {
    touchStartX.current = 0;
  };

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
    <div className="bg-white md:rounded-2xl shadow-none md:shadow-lg border-0 md:border md:border-slate-200 md:overflow-hidden flex flex-col md:h-full relative pb-28 md:pb-0">
      {participants.isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Mobile Sticky Segmented Control (pinned under MobileHeader) */}
      <div
        className="md:hidden sticky top-[calc(56px+env(safe-area-inset-top,0px))] z-20 bg-white/95 backdrop-blur-md px-4 pt-2.5 pb-2 border-b border-slate-200/80 shadow-xs"
        data-testid="event-detail-mobile-tabs"
      >
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

      {/* Mobile Collapsible Header Accordion Banner */}
      <div className="md:hidden border-b border-slate-200/70 bg-white" data-testid="event-detail-mobile-collapsible-header">
        <button
          type="button"
          onClick={() => setIsHeaderExpanded(prev => !prev)}
          data-testid="event-detail-header-toggle"
          aria-expanded={isHeaderExpanded}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/90 hover:bg-slate-100/80 active:bg-slate-100 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="text-sm shrink-0">{sportConfig?.type ? (SPORT_EMOJI[sportConfig.type] ?? '🏐') : '🏐'}</span>
            <span data-testid="mobile-header-summary" className="text-xs text-slate-700 font-semibold truncate">
              {`${formattedDate} • ${event.time} • ${event.location} • ${costPerPerson} Kč/os.`}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 shrink-0 ml-1">
            <span>{isHeaderExpanded ? 'Méně' : 'Info'}</span>
            <ChevronDown size={14} className={`transform transition-transform duration-200 ${isHeaderExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </div>

      {/* Event Detail Header: Collapsible on mobile, always visible on desktop */}
      <div
        className={isHeaderExpanded ? 'block animate-fade-in' : 'hidden md:block'}
        data-testid="event-detail-header-container"
      >
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
      </div>

      {/* Main Content Area */}
      <div
        className="p-4 sm:p-6 md:p-6 md:flex-1 md:overflow-y-auto pb-6 overscroll-contain custom-scrollbar touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        data-testid="event-detail-swipeable-content"
      >
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
                  onSelectUser={setInspectingUserId}
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


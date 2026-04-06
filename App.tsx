import React, { useState, useEffect } from 'react';
import { SportEvent, User, DebtItem, BankAccount, SportConfig, SportType } from './types';
import * as storage from './services/storage';
import { calculateDebts } from './utils/debt';
import { CalendarView } from './components/CalendarView';
import { EventDetail } from './components/EventDetail';
import { EventList } from './components/EventList';
import { CreateEventModal } from './components/CreateEventModal';
import { ConfirmModal } from './components/ConfirmModal';
import { UnpaidBanner } from './components/UnpaidBanner';
import { LoginScreen } from './components/LoginScreen';
import { BankAccountSettingsModal } from './components/BankAccountSettingsModal';
import { StatsPage } from './components/StatsPage';
import { ReleaseNotesPage } from './components/ReleaseNotesPage';
import { MobileBottomNav, MobileView } from './components/MobileBottomNav';
import { MobileHeader } from './components/MobileHeader';
import { Calendar as CalendarIcon, Trophy, LogOut, Loader2, Settings, BarChart3, Info } from 'lucide-react';
import { isSameDay, startOfDay } from 'date-fns';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [unpaidDebts, setUnpaidDebts] = useState<DebtItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('calendar');
  const [sportConfigs, setSportConfigs] = useState<SportConfig[]>([]);
  const [sportFilter, setSportFilter] = useState<SportType | null>(null);

  // ── Data loading ──

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      setEvents(await storage.getEvents());
    } catch (error) {
      console.error("Failed to load events", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBankAccounts = async () => {
    try {
      setBankAccounts(await storage.getBankAccounts());
    } catch (error) {
      console.error("Failed to load bank accounts", error);
    }
  };

  const loadSportConfigs = async () => {
    try {
      setSportConfigs(await storage.getSportConfigs());
    } catch (error) {
      console.error("Failed to load sport configs", error);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    loadEvents();
    loadBankAccounts();
    loadSportConfigs();
  }, [currentUser]);

  // Auto-select first upcoming event
  useEffect(() => {
    if (!currentUser || events.length === 0 || selectedEventId) return;
    const today = startOfDay(new Date());
    const upcoming = events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (upcoming.length > 0) setSelectedEventId(upcoming[0].id);
  }, [currentUser, events, selectedEventId]);

  // Recalculate debts using extracted pure function
  useEffect(() => {
    if (!currentUser || events.length === 0) {
      setUnpaidDebts([]);
      return;
    }
    setUnpaidDebts(calculateDebts(events, currentUser));
  }, [currentUser, events]);

  // ── Handlers ──

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setSelectedDate(null);
    setViewDate(new Date());
    setMobileView('calendar');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedEventId(null);
    setUnpaidDebts([]);
    setMobileView('calendar');
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    // Reload events so participant names/photos reflect the change
    loadEvents();
  };

  const handleCreateEvent = async (newEvent: SportEvent) => {
    setIsLoading(true);
    const updatedList = await storage.createEvent(newEvent);
    setEvents(updatedList);
    setIsLoading(false);
    setIsModalOpen(false);
    setSelectedEventId(newEvent.id);
    if (selectedDate) {
      setSelectedDate(new Date(newEvent.date));
      setViewDate(new Date(newEvent.date));
    }
    setMobileView('detail');
  };

  const handleUpdateEvent = async (updatedEvent: SportEvent) => {
    setEvents(await storage.updateEvent(updatedEvent));
  };

  const handleRequestDelete = (id: string) => setEventToDelete(id);

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    setIsLoading(true);
    const updatedList = await storage.deleteEvent(eventToDelete);
    setEvents(updatedList);
    setIsLoading(false);
    if (selectedEventId === eventToDelete) {
      setSelectedEventId(null);
      setMobileView('calendar');
    }
    setEventToDelete(null);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setViewDate(date);
    const eventsOnDay = events
      .filter(e => isSameDay(new Date(e.date), date))
      .sort((a, b) => a.time.localeCompare(b.time));
    setSelectedEventId(eventsOnDay.length > 0 ? eventsOnDay[0].id : null);
  };

  const handleShowUpcoming = () => {
    setSelectedDate(null);
    setViewDate(new Date());
    setSelectedEventId(null);
  };

  const handleMobileEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    setMobileView('detail');
  };

  const handleMobileNavigate = (view: MobileView) => {
    setShowStats(view === 'stats');
    setShowChangelog(view === 'changelog');
    setMobileView(view);
  };

  const handleMobileBack = () => {
    setMobileView('calendar');
    setShowStats(false);
    setShowChangelog(false);
  };

  // ── Derived state ──

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  const isUpcomingMode = selectedDate === null;
  const displayedEvents = isUpcomingMode
    ? events
        .filter(e => new Date(e.date) >= startOfDay(new Date()))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : events.filter(e => isSameDay(new Date(e.date), selectedDate));

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/*  MOBILE LAYOUT (md:hidden)                 */}
      {/* ═══════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col min-h-screen pb-16">
        <MobileHeader
          mobileView={mobileView}
          currentUser={currentUser}
          selectedEvent={selectedEvent}
          onBack={handleMobileBack}
          onLogout={handleLogout}
        />

        {mobileView === 'calendar' && <UnpaidBanner debts={unpaidDebts} />}

        {/* Mobile: Calendar View */}
        {mobileView === 'calendar' && (
          <div className="flex-1 overflow-y-auto p-4 animate-fade-in-up">
            <section className="mb-6">
              <CalendarView
                currentDate={viewDate}
                selectedDate={selectedDate}
                onDateChange={handleDateSelect}
                onMonthChange={setViewDate}
                events={events}
              />
            </section>
            <section>
              <EventList
                events={displayedEvents}
                selectedEventId={selectedEventId}
                selectedDate={selectedDate}
                onSelectEvent={handleMobileEventSelect}
                onDeleteEvent={handleRequestDelete}
                onShowUpcoming={handleShowUpcoming}
                onCreateEvent={() => setIsModalOpen(true)}
                showChevron
                showAddButton={false}
                sportConfigs={sportConfigs}
                sportFilter={sportFilter}
                onSportFilterChange={setSportFilter}
              />
            </section>
          </div>
        )}

        {/* Mobile: Event Detail View */}
        {mobileView === 'detail' && (
          <div className="flex-1 overflow-y-auto animate-slide-in-right">
            {selectedEvent ? (
              <EventDetail
                event={selectedEvent}
                currentUser={currentUser}
                bankAccounts={bankAccounts}
                sportConfigs={sportConfigs}
                allEvents={events}
                onUpdate={handleUpdateEvent}
                onDelete={handleRequestDelete}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 p-8 min-h-[50vh]">
                <CalendarIcon size={32} className="text-slate-300" />
                <p className="text-center text-sm">Vyberte událost z kalendáře.</p>
              </div>
            )}
          </div>
        )}

        {/* Mobile: Stats View */}
        {mobileView === 'stats' && (
          <div className="flex-1 overflow-y-auto p-4 animate-slide-in-right">
            <StatsPage
              events={events}
              currentUser={currentUser}
              isLoading={isLoading}
              onClose={handleMobileBack}
              sportConfigs={sportConfigs}
            />
          </div>
        )}

        {/* Mobile: Changelog View */}
        {mobileView === 'changelog' && (
          <div className="flex-1 overflow-y-auto p-4 animate-slide-in-right">
            <ReleaseNotesPage onClose={handleMobileBack} />
          </div>
        )}

        <MobileBottomNav
          activeView={mobileView}
          onNavigate={handleMobileNavigate}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onCreateEvent={() => setIsModalOpen(true)}
        />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/*  DESKTOP LAYOUT (hidden md:flex/md:block)  */}
      {/* ═══════════════════════════════════════════ */}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[400px] lg:w-[450px] flex-col bg-white border-r border-slate-200 h-screen sticky top-0 overflow-hidden">
        {/* Desktop Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3 font-bold text-xl text-slate-800">
            <div className="bg-blue-600 text-white p-2 rounded-lg"><Trophy size={20} /></div>
            Sport Plánovač
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">Ahoj, {currentUser.name}</span>
            <button onClick={() => setShowStats(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Statistiky">
              <BarChart3 size={20} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Bankovní účty">
              <Settings size={20} />
            </button>
            <button onClick={() => { setShowChangelog(true); setShowStats(false); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Seznam změn">
              <Info size={20} />
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Odhlásit">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <UnpaidBanner debts={unpaidDebts} />

        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          <div className="mb-6">
            <CalendarView
              currentDate={viewDate}
              selectedDate={selectedDate}
              onDateChange={handleDateSelect}
              onMonthChange={setViewDate}
              events={events}
            />
          </div>
          <EventList
            events={displayedEvents}
            selectedEventId={selectedEventId}
            selectedDate={selectedDate}
            onSelectEvent={setSelectedEventId}
            onDeleteEvent={handleRequestDelete}
            onShowUpcoming={handleShowUpcoming}
            onCreateEvent={() => setIsModalOpen(true)}
            sportConfigs={sportConfigs}
            sportFilter={sportFilter}
            onSportFilterChange={setSportFilter}
          />
        </div>
      </div>

      {/* Desktop Main Content */}
      <div className="hidden md:block flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto h-screen">
        {showChangelog ? (
          <ReleaseNotesPage onClose={() => setShowChangelog(false)} />
        ) : showStats ? (
          <StatsPage events={events} currentUser={currentUser} isLoading={isLoading} onClose={() => setShowStats(false)} sportConfigs={sportConfigs} />
        ) : selectedEvent ? (
          <EventDetail event={selectedEvent} currentUser={currentUser} bankAccounts={bankAccounts} sportConfigs={sportConfigs} allEvents={events} onUpdate={handleUpdateEvent} onDelete={handleRequestDelete} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 min-h-[50vh]">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
              <CalendarIcon size={32} className="text-slate-400" />
            </div>
            <p className="text-lg font-medium text-center max-w-sm">
              {isUpcomingMode ? 'Vyberte událost ze seznamu nadcházejících.' : 'Vyberte událost z vybraného dne.'}
            </p>
          </div>
        )}
      </div>

      {/* ═══ MODALS (shared) ═══ */}
      {isModalOpen && (
        <CreateEventModal selectedDate={selectedDate || new Date()} onClose={() => setIsModalOpen(false)} onCreate={handleCreateEvent} sportConfigs={sportConfigs} bankAccounts={bankAccounts} />
      )}
      <ConfirmModal
        isOpen={!!eventToDelete}
        title="Smazat událost?"
        message="Opravdu chcete tuto událost nenávratně odstranit? Přijdete o seznam účastníků i záznamy o platbách."
        onConfirm={confirmDelete}
        onCancel={() => setEventToDelete(null)}
      />
      {currentUser && (
        <BankAccountSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentUser={currentUser}
          bankAccounts={bankAccounts}
          onBankAccountsChange={setBankAccounts}
          onUserUpdate={handleUserUpdate}
          onShowChangelog={() => { setShowChangelog(true); setMobileView('changelog'); }}
          sportConfigs={sportConfigs}
          onSportConfigsChange={setSportConfigs}
        />
      )}
    </div>
  );
};

export default App;


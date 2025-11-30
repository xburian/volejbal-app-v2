import React, { useState, useEffect } from 'react';
import { VolleyballEvent, User, DebtItem } from './types';
import * as storage from './services/storage';
import { CalendarView } from './components/CalendarView';
import { EventDetail } from './components/EventDetail';
import { CreateEventModal } from './components/CreateEventModal';
import { ConfirmModal } from './components/ConfirmModal';
import { UnpaidBanner } from './components/UnpaidBanner';
import { LoginScreen } from './components/LoginScreen';
import { Plus, Calendar as CalendarIcon, Trophy, LogOut, Trash2, ListFilter, ArrowLeft, Loader2 } from 'lucide-react';
import { format, isSameDay, differenceInCalendarDays, startOfDay } from 'date-fns';
import { cs } from 'date-fns/locale';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [events, setEvents] = useState<VolleyballEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // viewDate controls which month is shown in the calendar
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  // selectedDate controls filtering. If null, we show "Upcoming"
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for delete confirmation
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  // State for unpaid debts
  const [unpaidDebts, setUnpaidDebts] = useState<DebtItem[]>([]);

  // Load events helper
  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getEvents();
      setEvents(data);
    } catch (error) {
      console.error("Failed to load events", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, []);

  // Check for debts whenever user or events change
  useEffect(() => {
    if (!currentUser || events.length === 0) {
      setUnpaidDebts([]);
      return;
    }

    const today = new Date();
    const debts: DebtItem[] = [];

    events.forEach(event => {
      // Determine if event is overdue
      let isOverdue = false;
      let daysOverdue = 0;

      // Fallback Logic: Overdue if more than 6 days past the event (assuming weekly games)
      const eventDate = new Date(event.date);
      const diff = differenceInCalendarDays(today, eventDate);
      
      // Simple logic: if event was more than 1 day ago and I joined but haven't paid
      if (diff > 1) {
        isOverdue = true;
        daysOverdue = diff;
      }

      if (isOverdue) {
        const myParticipation = event.participants.find(p => p.userId === currentUser.id);

        // Condition: User joined AND has NOT paid
        if (myParticipation && myParticipation.status === 'joined' && !myParticipation.hasPaid) {
          
          // Calculate cost per person for this specific event
          const joinedCount = event.participants.filter(p => p.status === 'joined').length;
          const costPerPerson = joinedCount > 0 ? Math.ceil(event.totalCost / joinedCount) : 0;

          debts.push({
            event,
            amount: costPerPerson,
            daysOverdue
          });
        }
      }
    });

    setUnpaidDebts(debts);

  }, [currentUser, events]); 

  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    // Refresh events on login to ensure fresh data
    await loadEvents();
    
    // Reset views on login
    setSelectedDate(null); 
    setViewDate(new Date());
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedEventId(null);
    setUnpaidDebts([]);
  };

  const handleCreateEvent = async (newEvent: VolleyballEvent) => {
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
  };

  const handleUpdateEvent = async (updatedEvent: VolleyballEvent) => {
    // Optimistic update could go here, but let's keep it safe
    const updatedList = await storage.updateEvent(updatedEvent);
    setEvents(updatedList);
  };

  const handleRequestDelete = (id: string) => {
    setEventToDelete(id);
  };

  const confirmDelete = async () => {
    if (eventToDelete) {
      setIsLoading(true);
      const updatedList = await storage.deleteEvent(eventToDelete);
      setEvents(updatedList);
      setIsLoading(false);
      
      if (selectedEventId === eventToDelete) {
        setSelectedEventId(null);
      }
      setEventToDelete(null);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setViewDate(date); 
    if (selectedEvent && !isSameDay(new Date(selectedEvent.date), date)) {
      setSelectedEventId(null);
    }
  };

  const handleShowUpcoming = () => {
    setSelectedDate(null);
    setViewDate(new Date()); 
    setSelectedEventId(null);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Filter events logic
  let displayedEvents: VolleyballEvent[] = [];
  const isUpcomingMode = selectedDate === null;

  if (isUpcomingMode) {
    const today = startOfDay(new Date());
    displayedEvents = events
      .filter(e => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } else {
    displayedEvents = events.filter(e => isSameDay(new Date(e.date), selectedDate));
  }
  
  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row text-slate-900">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <Loader2 className="animate-spin text-blue-600" size={48} />
        </div>
      )}
      
      {/* Mobile Header */}
      <div className="md:hidden flex flex-col shadow-md z-20 relative">
        <div className="bg-blue-700 text-white p-4 flex items-center justify-between">
           <div className="flex items-center gap-2 font-bold text-lg">
             <Trophy size={24} />
             <span>Volejbal</span>
           </div>
           <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsModalOpen(true)}
               className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
             >
               <Plus size={20} />
             </button>
             <button 
               onClick={handleLogout}
               className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
             >
               <LogOut size={20} />
             </button>
           </div>
        </div>
        <UnpaidBanner debts={unpaidDebts} />
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-[400px] lg:w-[450px] flex flex-col bg-white border-r border-slate-200 h-auto md:h-screen md:sticky md:top-0 overflow-hidden">
        
        {/* Desktop Header */}
        <div className="hidden md:flex p-6 border-b border-slate-100 items-center justify-between bg-slate-50">
           <div className="flex items-center gap-3 font-bold text-xl text-slate-800">
             <div className="bg-blue-600 text-white p-2 rounded-lg">
               <Trophy size={20} />
             </div>
             Volejbal Plánovač
           </div>
           
           <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-slate-600">Ahoj, {currentUser.name}</span>
             <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Odhlásit"
             >
               <LogOut size={20} />
             </button>
           </div>
        </div>

        <div className="hidden md:block">
          <UnpaidBanner debts={unpaidDebts} />
        </div>

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

          <div>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex flex-col">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  {isUpcomingMode ? (
                    <>
                      <ListFilter size={18} className="text-blue-500"/>
                      Nadcházející
                    </>
                  ) : (
                    <>
                      <CalendarIcon size={18} className="text-blue-500"/>
                      {selectedDate && format(selectedDate, 'd. MMMM', { locale: cs })}
                    </>
                  )}
                </h3>
                
                {!isUpcomingMode && (
                  <button 
                    onClick={handleShowUpcoming}
                    className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 mt-1 font-medium transition-colors"
                  >
                    <ArrowLeft size={12} />
                    Zobrazit všechny nadcházející
                  </button>
                )}
              </div>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus size={16} /> Přidat
              </button>
            </div>

            <div className="space-y-3 pb-8">
              {displayedEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-sm">
                    {isUpcomingMode 
                      ? 'Žádné nadcházející události.' 
                      : 'Žádné události pro tento den.'}
                  </p>
                  <button onClick={() => setIsModalOpen(true)} className="mt-2 text-blue-600 text-sm hover:underline font-medium">
                    Vytvořit novou
                  </button>
                </div>
              ) : (
                displayedEvents.map(event => (
                  <div 
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`
                      p-4 rounded-xl border transition-all cursor-pointer group relative
                      ${selectedEventId === event.id 
                        ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200' 
                        : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`font-bold pr-6 ${selectedEventId === event.id ? 'text-blue-900' : 'text-slate-800'}`}>{event.title}</h4>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-bold ${selectedEventId === event.id ? 'text-blue-600' : 'text-slate-500'}`}>
                           {format(new Date(event.date), 'd. M.', { locale: cs })}
                        </span>
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {event.time}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-slate-500 mt-2">
                      <span className="truncate max-w-[150px]">{event.location}</span>
                      <div className="flex items-center gap-3">
                         <UsersIcon count={event.participants.filter(p => p.status === 'joined').length} />
                         
                         <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestDelete(event.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                            title="Smazat událost"
                         >
                           <Trash2 size={16} />
                         </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto h-auto md:h-screen">
        {selectedEvent ? (
          <EventDetail 
            event={selectedEvent} 
            currentUser={currentUser}
            onUpdate={handleUpdateEvent}
            onDelete={handleRequestDelete}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 min-h-[50vh]">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
              <CalendarIcon size={32} className="text-slate-400" />
            </div>
            <p className="text-lg font-medium text-center max-w-sm">
              {isUpcomingMode 
                ? 'Vyberte událost ze seznamu nadcházejících.' 
                : 'Vyberte událost z vybraného dne.'}
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <CreateEventModal 
          selectedDate={selectedDate || new Date()} 
          onClose={() => setIsModalOpen(false)} 
          onCreate={handleCreateEvent} 
        />
      )}

      <ConfirmModal
        isOpen={!!eventToDelete}
        title="Smazat událost?"
        message="Opravdu chcete tuto událost nenávratně odstranit? Přijdete o seznam účastníků i záznamy o platbách."
        onConfirm={confirmDelete}
        onCancel={() => setEventToDelete(null)}
      />
    </div>
  );
};

const UsersIcon = ({ count }: { count: number }) => (
  <div className="flex items-center gap-1 text-xs font-medium">
    <div className="flex -space-x-2">
       {[...Array(Math.min(count, 3))].map((_, i) => (
         <div key={i} className="w-5 h-5 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] text-blue-600">
           U
         </div>
       ))}
    </div>
    {count > 0 && <span>{count}</span>}
    {count === 0 && <span>0</span>}
  </div>
);

export default App;
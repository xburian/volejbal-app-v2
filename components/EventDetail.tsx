import React, { useMemo, useState, useEffect } from 'react';
import { VolleyballEvent, Participant, User } from '../types';
import * as storage from '../services/storage';
import { Users, Trash2, Wallet, Hand, AlertTriangle, Edit2, Check, X, Loader2, Copy } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';

interface EventDetailProps {
  event: VolleyballEvent;
  currentUser: User;
  onUpdate: (updatedEvent: VolleyballEvent) => void;
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

export const EventDetail: React.FC<EventDetailProps> = ({ event, currentUser, onUpdate, onDelete }) => {
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [tempAccountNumber, setTempAccountNumber] = useState(event.accountNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [tempTotalCost, setTempTotalCost] = useState(event.totalCost);

  useEffect(() => {
    setTempAccountNumber(event.accountNumber);
    setIsEditingAccount(false);
    setTempTotalCost(event.totalCost);
    setIsEditingCost(false);
  }, [event.id, event.accountNumber, event.totalCost]);

  const joinedParticipants = event.participants.filter(p => p.status === 'joined');
  const countJoined = joinedParticipants.length;
  const costPerPerson = countJoined > 0 ? Math.ceil(event.totalCost / countJoined) : 0;
  
  const currentUserParticipant = event.participants.find(p => p.userId === currentUser.id);
  const isCurrentUserJoined = currentUserParticipant?.status === 'joined';

  const iban = useMemo(() => convertToCZIBAN(event.accountNumber), [event.accountNumber]);
  const qrString = iban 
    ? `SPD*1.0*ACC:${iban}*AM:${costPerPerson}.00*CC:CZK*MSG:Volejbal ${event.date}`
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

  const handleStatusChange = async (userId: string, status: Participant['status']) => {
    setIsLoading(true);
    await storage.updateAttendance(event.id, userId, status);
    await refreshEventData();
  };

  const handlePaymentToggle = async (userId: string, currentStatus: boolean) => {
    const participant = event.participants.find(p => p.userId === userId);
    if (participant) {
      setIsLoading(true);
      await storage.updateAttendance(event.id, userId, participant.status, !currentStatus);
      await refreshEventData();
    }
  };

  const handleSaveAccount = () => {
    const updatedEvent = { ...event, accountNumber: tempAccountNumber };
    onUpdate(updatedEvent);
    setIsEditingAccount(false);
  };

  const handleCancelEdit = () => {
    setTempAccountNumber(event.accountNumber);
    setIsEditingAccount(false);
  };

  const handleCopyToClipboard = async () => {
    if (event.accountNumber) {
      try {
        await navigator.clipboard.writeText(event.accountNumber);
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

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
           <Loader2 className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">{event.title}</h2>
            <span className="text-lg text-slate-500 font-medium">
              {format(new Date(event.date), 'dd.MM.yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 mt-2 text-sm">
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

      <div className="flex-1 overflow-y-auto p-6 grid lg:grid-cols-2 gap-8">
        
        {/* Left Column: Participants */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center justify-between">
              Účastníci ({countJoined})
              <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {costPerPerson} Kč / os.
              </span>
            </h3>

            {/* Quick Join Button for Current User */}
            {!isCurrentUserJoined && (
              <button 
                onClick={() => handleStatusChange(currentUser.id, 'joined')}
                disabled={isLoading}
                className="w-full mb-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <Hand size={20} />
                Jdu hrát
              </button>
            )}

            <div className="space-y-2">
              {event.participants.map(p => {
                const isMe = p.userId === currentUser.id;
                
                return (
                  <div key={p.userId} className={`flex items-center justify-between p-2 border rounded-lg shadow-sm hover:shadow-md transition-shadow group ${isMe ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${
                        p.status === 'joined' ? 'bg-green-500' : 
                        p.status === 'declined' ? 'bg-red-500' : 'bg-yellow-400'
                      }`}></div>
                      <div>
                        <p className={`font-medium text-sm ${isMe ? 'text-blue-800' : 'text-slate-800'}`}>
                          {p.name} {isMe && '(Já)'}
                        </p>
                        
                        {/* Status Controls - Only visible for current user */}
                        {isMe ? (
                          <div className="flex gap-2 text-xs mt-0.5">
                            <button 
                              disabled={isLoading}
                              onClick={() => handleStatusChange(p.userId, 'joined')}
                              className={`hover:underline ${p.status === 'joined' ? 'font-bold text-green-600' : 'text-slate-400'}`}
                            >Jdu</button>
                             <span className="text-slate-300">|</span>
                            <button 
                              disabled={isLoading}
                              onClick={() => handleStatusChange(p.userId, 'declined')}
                              className={`hover:underline ${p.status === 'declined' ? 'font-bold text-red-600' : 'text-slate-400'}`}
                            >Nejdu</button>
                          </div>
                        ) : (
                          // Read-only status for others
                          <div className="text-xs mt-0.5 font-medium text-slate-500 flex items-center gap-1">
                            {p.status === 'joined' ? 'Jde hrát' : p.status === 'declined' ? 'Nejde' : 'Možná'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {p.status === 'joined' && (
                        <label className="flex items-center gap-2 cursor-pointer select-none group/checkbox p-1 rounded hover:bg-slate-50 transition-colors">
                           <input 
                             type="checkbox" 
                             checked={p.hasPaid}
                             disabled={isLoading}
                             onChange={() => handlePaymentToggle(p.userId, p.hasPaid)}
                             className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer disabled:opacity-50"
                           />
                           <span className={`text-xs ${p.hasPaid ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                             {p.hasPaid ? 'Zaplaceno' : 'Nezaplaceno'}
                           </span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}

              {event.participants.length === 0 && (
                <p className="text-center text-slate-400 py-4 italic">Zatím žádní účastníci.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Payment Info */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-fit">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-blue-600"/> 
            Platební údaje
          </h3>
          
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                 <p className="text-xs text-slate-500 uppercase tracking-wide">Číslo účtu</p>
                 {!isEditingAccount ? (
                   <button 
                    onClick={() => setIsEditingAccount(true)}
                    className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                    title="Upravit číslo účtu"
                   >
                     <Edit2 size={14} />
                   </button>
                 ) : (
                   <div className="flex gap-2">
                      <button onClick={handleSaveAccount} className="text-green-600 hover:bg-green-50 p-1 rounded transition-colors"><Check size={16}/></button>
                      <button onClick={handleCancelEdit} className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"><X size={16}/></button>
                   </div>
                 )}
              </div>
              
              {!isEditingAccount ? (
                <div className="flex items-center gap-2">
                  <p className="text-xl font-mono text-slate-800 tracking-wider select-all truncate flex-1">
                    {event.accountNumber || 'Nezadáno'}
                  </p>
                  {event.accountNumber && (
                    <button
                      onClick={handleCopyToClipboard}
                      className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors flex-shrink-0"
                      title="Zkopírovat číslo účtu"
                    >
                      {isCopied ? (
                        <Check size={18} className="text-green-600" />
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <input 
                  type="text"
                  value={tempAccountNumber}
                  onChange={(e) => setTempAccountNumber(e.target.value)}
                  className="w-full text-lg font-mono p-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-200 outline-none bg-white text-slate-900"
                  placeholder="123456/0100"
                />
              )}

              {event.accountNumber && !iban && !isEditingAccount && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> Neplatný formát pro QR platbu
                </p>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Částka na osobu</p>
              <p className="text-3xl font-bold text-blue-600">{costPerPerson} Kč</p>
            </div>

            {countJoined > 0 && event.accountNumber && qrString && (
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
            
            {(!countJoined || !event.accountNumber || (event.accountNumber && !qrString)) && (
               <div className="text-center p-4 text-slate-400 text-sm italic">
                 {!countJoined ? "Přidejte účastníky pro výpočet ceny." : 
                  !event.accountNumber ? "Chybí číslo účtu." : 
                  "Nelze vygenerovat QR kód (chybné číslo účtu)."}
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
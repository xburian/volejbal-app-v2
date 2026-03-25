import React, { useMemo, useState, useEffect } from 'react';
import { VolleyballEvent, Participant, User, BankAccount } from '../types';
import * as storage from '../services/storage';
import { Users, Trash2, Wallet, Hand, AlertTriangle, Edit2, Check, X, Loader2, Copy, ChevronDown, Shuffle, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';

interface EventDetailProps {
  event: VolleyballEvent;
  currentUser: User;
  bankAccounts: BankAccount[];
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

export const EventDetail: React.FC<EventDetailProps> = ({ event, currentUser, bankAccounts = [], onUpdate, onDelete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [tempTotalCost, setTempTotalCost] = useState(event.totalCost);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Determine the selected bank account
  const selectedBankAccount = useMemo(() => {
    if (event.selectedBankAccountId) {
      return bankAccounts.find(a => a.id === event.selectedBankAccountId) || null;
    }
    return null;
  }, [event.selectedBankAccountId, bankAccounts]);

  const effectiveAccountNumber = selectedBankAccount?.accountNumber || event.accountNumber || '';
  const selectedAccountOwner = selectedBankAccount?.ownerName || '';

  const [teams, setTeams] = useState<[Participant[], Participant[]] | null>(null);

  useEffect(() => {
    setTempTotalCost(event.totalCost);
    setIsEditingCost(false);
  }, [event.id, event.totalCost]);

  const joinedParticipants = event.participants.filter(p => p.status === 'joined');

  const shuffleTeams = () => {
    const shuffled = [...joinedParticipants].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setTeams([shuffled.slice(0, mid), shuffled.slice(mid)]);
  };

  useEffect(() => {
    if (joinedParticipants.length >= 2) {
      shuffleTeams();
    } else {
      setTeams(null);
    }
  }, [event.id, joinedParticipants.length]);
  const countJoined = joinedParticipants.length;
  const costPerPerson = countJoined > 0 ? Math.ceil(event.totalCost / countJoined) : 0;
  
  const currentUserParticipant = event.participants.find(p => p.userId === currentUser.id);
  const isCurrentUserJoined = currentUserParticipant?.status === 'joined';

  const iban = useMemo(() => convertToCZIBAN(effectiveAccountNumber), [effectiveAccountNumber]);
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

            {/* Photo Error Message */}
            {photoError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {photoError}
              </div>
            )}

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

          {/* Team Split */}
          {countJoined >= 2 && teams && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                  <Shuffle size={18} className="text-indigo-500" />
                  Rozdělení do týmů
                </h3>
                <button
                  onClick={shuffleTeams}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <RefreshCw size={14} />
                  Zamíchat
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {teams.map((team, teamIdx) => (
                  <div key={teamIdx} className={`rounded-lg border p-3 ${teamIdx === 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                    <h4 className={`text-sm font-bold mb-2 ${teamIdx === 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      Tým {teamIdx + 1} ({team.length})
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
                ))}
              </div>
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
                        {a.ownerName} — {a.accountNumber}
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
                    {effectiveAccountNumber}
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
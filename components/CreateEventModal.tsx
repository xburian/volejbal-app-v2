import React, { useState } from 'react';
import { SportEvent, SportConfig, SportType, SPORT_EMOJI, BankAccount, maskAccountNumber } from '../types';
import { X, Users, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';


interface CreateEventModalProps {
  selectedDate: Date;
  onClose: () => void;
  onCreate: (event: SportEvent) => void;
  sportConfigs: SportConfig[];
  bankAccounts?: BankAccount[];
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ selectedDate, onClose, onCreate, sportConfigs, bankAccounts = [] }) => {
  const defaultConfig = sportConfigs[0] ?? { type: 'volejbal' as SportType, label: 'Volejbal', maxPlayers: 12, defaultCost: 1000, defaultLocation: 'Hala', teamSize: null };

  const [selectedSport, setSelectedSport] = useState<SportType>(defaultConfig.type);
  const currentConfig = sportConfigs.find(c => c.type === selectedSport) ?? defaultConfig;

  // Pre-select first bank account if available
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(bankAccounts[0]?.id ?? '');

  // Initialize date from props, but allow editing
  const [formData, setFormData] = useState({
    title: currentConfig.label,
    date: format(selectedDate, 'yyyy-MM-dd'),
    time: '18:00',
    location: currentConfig.defaultLocation,
    totalCost: currentConfig.defaultCost,
    description: '',
  });

  const handleSportChange = (type: SportType) => {
    setSelectedSport(type);
    const config = sportConfigs.find(c => c.type === type);
    if (config) {
      setFormData(prev => ({
        ...prev,
        title: config.label,
        location: config.defaultLocation,
        totalCost: config.defaultCost,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedAccount = bankAccounts.find(a => a.id === selectedBankAccountId);
    const newEvent: SportEvent = {
      date: formData.date,
      participants: [],
      ...formData,
      accountNumber: selectedAccount?.accountNumber ?? '',
      selectedBankAccountId: selectedAccount?.id,
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      totalCost: Number(formData.totalCost),
      sportType: selectedSport,
    };
    onCreate(newEvent);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-lg text-slate-800">Přidat událost</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Sport Type Selector — FIRST FIELD */}
          {sportConfigs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Typ sportu</label>
              <div className="flex flex-wrap gap-2" data-testid="sport-type-selector">
                {sportConfigs.map(config => (
                  <button
                    key={config.type}
                    type="button"
                    onClick={() => handleSportChange(config.type)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border
                      ${selectedSport === config.type
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'}
                    `}
                    data-testid={`sport-type-${config.type}`}
                  >
                    <span>{SPORT_EMOJI[config.type] ?? '🏅'}</span>
                    {config.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500" data-testid="sport-info">
                <Users size={12} />
                Max hráčů: {currentConfig.maxPlayers}
                {currentConfig.teamSize && (
                  <span className="ml-2">• Tým: {currentConfig.teamSize} hráči</span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Název</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
             <input
               required
               type="date"
               value={formData.date}
               onChange={e => setFormData({...formData, date: e.target.value})}
               className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Čas</label>
              <input
                required
                type="time"
                value={formData.time}
                onChange={e => setFormData({...formData, time: e.target.value})}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cena (Kč)</label>
              <input
                required
                type="number"
                min="0"
                value={formData.totalCost}
                onChange={e => setFormData({...formData, totalCost: Number(e.target.value)})}
                className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Místo</label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bankovní účet (pro QR)</label>
            {bankAccounts.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedBankAccountId}
                  onChange={e => setSelectedBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none pr-8 cursor-pointer"
                  data-testid="bank-account-select"
                >
                  <option value="">Bez účtu</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.ownerName} — {maskAccountNumber(a.accountNumber)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic py-2">
                Žádné účty. Přidejte si účet v nastavení (⚙️).
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Poznámka</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Vytvořit událost
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { VolleyballEvent } from '../types';
import { X } from 'lucide-react';
import { format } from 'date-fns';

interface CreateEventModalProps {
  selectedDate: Date;
  onClose: () => void;
  onCreate: (event: VolleyballEvent) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ selectedDate, onClose, onCreate }) => {
  // Initialize date from props, but allow editing
  const [formData, setFormData] = useState({
    title: 'Volejbal',
    date: format(selectedDate, 'yyyy-MM-dd'),
    time: '18:00',
    location: 'Hala',
    totalCost: 1000,
    accountNumber: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: VolleyballEvent = {
      // Removed the duplicate 'id' property here that was causing the error
      date: formData.date, // Use the form date, not the prop
      participants: [],
      ...formData,
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(), // Fallback generation
      totalCost: Number(formData.totalCost),
    };
    onCreate(newEvent);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Přidat událost</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Číslo účtu (pro QR)</label>
            <input
              type="text"
              placeholder="123456789/0100"
              value={formData.accountNumber}
              onChange={e => setFormData({...formData, accountNumber: e.target.value})}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
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
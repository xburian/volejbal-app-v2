import React, { useState, useEffect } from 'react';
import { User } from '../types';
import * as storage from '../services/storage';
import { UserPlus, LogIn, Trophy, Trash2, Loader2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for deleting user
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getUsers();
      setUsers(data);
    } catch (e) {
      setError("Nepodařilo se načíst uživatele.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      const newUser = await storage.createUser(newName);
      // We don't need to append manually, just reload or use the result
      // But for Firestore consistency, reloading is safer or appending is fine if we trust optimistic
      setUsers(prev => [...prev, newUser]);
      setNewName('');
      onLogin(newUser);
    } catch (err: any) {
      setError(err.message || 'Chyba při vytváření uživatele.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (userToDelete) {
      setIsLoading(true);
      try {
        await storage.deleteUser(userToDelete.id);
        setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
        setUserToDelete(null);
      } catch (e) {
        setError("Chyba při mazání uživatele.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
             <Loader2 className="animate-spin text-blue-600" />
          </div>
        )}

        <div className="bg-blue-600 p-8 text-center text-white">
          <div className="inline-block p-3 bg-white/20 rounded-full mb-4">
            <Trophy size={40} />
          </div>
          <h1 className="text-2xl font-bold">Vítejte ve Volejbalu</h1>
          <p className="text-blue-100 mt-2">Kdo dnes přišel?</p>
        </div>

        <div className="p-6">
          {/* User List */}
          <div className="mb-6">
             <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Vyberte svůj profil</h2>
             <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
               {users.map(user => (
                 <div key={user.id} className="relative group">
                   <button
                     onClick={() => onLogin(user)}
                     className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left pr-10"
                   >
                     <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm group-hover:bg-blue-200 group-hover:text-blue-700 shrink-0">
                       {user.name.charAt(0).toUpperCase()}
                     </div>
                     <span className="font-medium text-slate-700 group-hover:text-blue-900 truncate">{user.name}</span>
                   </button>
                   
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setUserToDelete(user);
                     }}
                     className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                     title="Smazat uživatele"
                   >
                     <Trash2 size={16} />
                   </button>
                 </div>
               ))}
               
               {!isLoading && users.length === 0 && (
                 <div className="col-span-2 text-center text-slate-400 text-sm py-4 italic">
                   Zatím žádní uživatelé. Vytvořte prvního.
                 </div>
               )}
             </div>
          </div>

          <div className="relative">
             <div className="absolute inset-0 flex items-center">
               <div className="w-full border-t border-slate-200"></div>
             </div>
             <div className="relative flex justify-center text-sm">
               <span className="px-2 bg-white text-slate-400">Nebo</span>
             </div>
          </div>

          {/* Create User Form */}
          <form onSubmit={handleCreateUser} className="mt-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Nový hráč</h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Vaše jméno..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit"
                disabled={!newName.trim() || isLoading}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <UserPlus size={18} />
                <span className="hidden sm:inline">Vytvořit</span>
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                {error}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={!!userToDelete}
        title="Smazat uživatele?"
        message={`Opravdu chcete smazat uživatele "${userToDelete?.name}"? Tímto krokem smažete i jeho historii účasti na všech akcích.`}
        onConfirm={confirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
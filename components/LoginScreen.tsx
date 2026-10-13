import React, { useState, useEffect } from 'react';
import { User, Team } from '../types';
import * as storage from '../services/storage';
import { UserPlus, Trophy, Trash2, Loader2, Search, LogOut, Sparkles, X, Camera } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  currentTeam?: Team | null;
  onLogoutTeam?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, currentTeam, onLogoutTeam }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // State for deleting user
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getUsers();
      setUsers(data);
    } catch (_e) {
      setError("Nepodařilo se načíst uživatele.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentTeam?.id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Obrázek je příliš velký. Maximum je 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!newName.trim()) return;

    setIsLoading(true);
    try {
      const newUser = await storage.createUser(newName, photoPreview || undefined);
      setUsers(prev => [...prev, newUser]);
      setNewName('');
      setPhotoPreview(null);
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
      } catch (_e) {
        setError("Chyba při mazání uživatele.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Normalize string to remove diacritics for search
  const normalizeString = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Filter users by search (server already returns sorted order)
  const filteredUsers = users
    .filter(user => {
      if (!searchQuery.trim()) return true;
      const normalizedName = normalizeString(user.name);
      const normalizedQuery = normalizeString(searchQuery);
      return normalizedName.includes(normalizedQuery);
    });

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-white md:bg-slate-900 md:bg-gradient-to-br md:from-slate-950 md:via-slate-900 md:to-indigo-950 md:items-center md:justify-center md:p-6 relative overflow-x-hidden">
      {/* Decorative background glow spheres (desktop only) */}
      <div className="hidden md:block absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden md:block absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full flex-1 flex flex-col bg-white md:flex-initial md:max-w-2xl md:rounded-3xl md:shadow-2xl md:border md:border-white/20 md:bg-white/95 md:backdrop-blur-xl md:overflow-hidden relative z-10 animate-fade-in">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
             <Loader2 className="animate-spin text-blue-600" size={36} />
          </div>
        )}

        {/* Hero Header with Athletic Lifestyle Vibe - Flat & edge-to-edge on mobile */}
        <div className="bg-blue-600 md:bg-gradient-to-r md:from-blue-700 md:via-indigo-700 md:to-blue-800 px-4 py-4 md:px-6 md:py-6 text-white flex items-center justify-between gap-3 relative shadow-none md:shadow-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 md:p-3 bg-white/15 backdrop-blur-sm rounded-xl md:rounded-2xl shrink-0 border border-white/20 flex items-center justify-center">
              <Trophy size={22} className="text-amber-300 md:w-[26px] md:h-[26px] drop-shadow-sm" />
            </div>
            <div className="text-left min-w-0">
              <h1 className="text-lg md:text-2xl font-black tracking-tight leading-tight truncate">
                Vítejte v Sport Plánovači
              </h1>
              {currentTeam ? (
                <div className="flex items-center gap-1.5 text-blue-100 text-xs mt-0.5">
                  <span className="font-semibold bg-white/15 px-2.5 py-0.5 rounded-full border border-white/20 truncate">
                    Tým: {currentTeam.name}
                  </span>
                </div>
              ) : (
                <p className="text-blue-100 text-xs md:text-sm mt-0.5">Kdo dnes přišel?</p>
              )}
            </div>
          </div>
          {onLogoutTeam && (
            <button
              onClick={onLogoutTeam}
              className="text-xs bg-white/15 hover:bg-white/25 active:scale-95 text-white font-medium px-3 py-2 rounded-xl border border-white/20 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-none md:shadow-sm"
              title="Změnit nebo odhlásit tým"
            >
              <LogOut size={14} />
              <span className="inline">Změnit tým</span>
            </button>
          )}
        </div>

        <div className="p-4 md:p-8 flex-1 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* User List Header & Filter */}
            <div className="mb-4 md:mb-6">
              <div className="flex items-center justify-between mb-2.5 md:mb-3">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span>Vyberte svůj profil</span>
                  {users.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                      {users.length} {users.length === 1 ? 'hráč' : users.length < 5 ? 'hráči' : 'hráčů'}
                    </span>
                  )}
                </h2>
              </div>

              {/* Modern Flat Search Bar with Clear Button */}
              <div className="relative mb-3 md:mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Hledat hráče..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-100 md:bg-slate-50/80 hover:bg-slate-50 border-0 md:border md:border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    title="Vymazat hledání"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Player Cards Grid - Flat styling on mobile */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3 max-h-[45vh] md:max-h-72 overflow-y-auto custom-scrollbar p-0.5">
                {filteredUsers.map(user => (
                  <div key={user.id} className="relative group">
                    <button
                      onClick={() => onLogin(user)}
                      className="w-full flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 rounded-xl border border-slate-100 md:border-slate-200/90 bg-slate-50 md:bg-white hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-xs active:scale-95 transition-all text-left pr-9 md:pr-10 shadow-none md:shadow-sm cursor-pointer"
                    >
                      {user.photoUrl ? (
                        <img
                          src={user.photoUrl}
                          alt={user.name}
                          className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shrink-0 ring-1 ring-slate-200 md:ring-2 md:ring-blue-500/20 shadow-none md:shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-600 md:bg-gradient-to-br md:from-blue-600 md:to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-none md:shadow-sm shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold text-slate-800 group-hover:text-blue-900 truncate text-xs sm:text-sm">
                        {user.name}
                      </span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserToDelete(user);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-70 md:opacity-0 group-hover:opacity-100 transition-all"
                      title="Smazat uživatele"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                {!isLoading && filteredUsers.length === 0 && users.length > 0 && (
                  <div className="col-span-2 md:col-span-3 text-center text-slate-400 text-sm py-6 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    Žádný hráč nenalezen.
                  </div>
                )}

                {!isLoading && users.length === 0 && (
                  <div className="col-span-2 md:col-span-3 text-center text-slate-400 text-sm py-8 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    Zatím žádní uživatelé. Vytvořte prvního.
                  </div>
                )}
              </div>
            </div>

            {/* Subtle Divider */}
            <div className="relative my-3 md:my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-3 bg-white text-slate-400 font-bold tracking-wider">Nebo</span>
              </div>
            </div>

            {/* Create User Section - Flat on mobile */}
            <form onSubmit={handleCreateUser} className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 md:p-4 transition-all focus-within:border-blue-400 focus-within:bg-white shadow-none md:shadow-sm">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 md:mb-3 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                Nový hráč
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Photo Upload */}
                <div className="flex items-center gap-3 shrink-0">
                  <label className="cursor-pointer group relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    {photoPreview ? (
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-14 h-14 rounded-full object-cover border-2 border-blue-500 shadow-md group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <Camera size={16} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-white border-2 border-dashed border-slate-300 group-hover:border-blue-500 group-hover:bg-blue-50/50 flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 text-xs text-center transition-all shadow-sm">
                        <span className="leading-tight text-[11px] font-semibold">Přidat<br/>foto</span>
                      </div>
                    )}
                  </label>
                  <div className="text-xs text-slate-500">
                    <p className="font-medium text-slate-700">Volitelné</p>
                    <p className="text-slate-400 text-[11px]">Max 2MB</p>
                  </div>
                </div>

                {/* Name Input & Create Button */}
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Vaše jméno..."
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all shadow-sm"
                  />
                  <button 
                    type="submit"
                    disabled={!newName.trim() || isLoading}
                    className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer text-sm"
                  >
                    <UserPlus size={16} />
                    <span className="inline">Vytvořit</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2 animate-shake">
                  <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full shrink-0"></span>
                  <span>{error}</span>
                </div>
              )}
            </form>
          </div>
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
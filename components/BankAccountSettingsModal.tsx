import React, { useState, useRef } from 'react';
import { BankAccount, User } from '../types';
import * as storage from '../services/storage';
import { X, Landmark, UserCircle, Loader2, AlertTriangle, Sparkles, Camera, Pencil, Check, Trash2, Settings as Settings2Icon } from 'lucide-react';

interface BankAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  bankAccounts: BankAccount[];
  onBankAccountsChange: (accounts: BankAccount[]) => void;
  onUserUpdate: (user: User) => void;
  onShowChangelog?: () => void;
}

export const BankAccountSettingsModal: React.FC<BankAccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  bankAccounts,
  onBankAccountsChange,
  onUserUpdate,
  onShowChangelog,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentUser.name);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // My account form
  const [myOwnerName, setMyOwnerName] = useState(currentUser.name);
  const [myAccountNumber, setMyAccountNumber] = useState('');

  if (!isOpen) return null;

  const myAccount = bankAccounts.find(a => a.userId === currentUser.id);

  const refreshAccounts = async () => {
    const updated = await storage.getBankAccounts();
    onBankAccountsChange(updated);
  };

  // ── Profile handlers ──

  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (!trimmed || trimmed === currentUser.name) {
      setIsEditingName(false);
      setTempName(currentUser.name);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updated = await storage.updateUser(currentUser.id, { name: trimmed });
      onUserUpdate(updated);
      setIsEditingName(false);
      setSuccessMessage('Jméno bylo změněno.');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Chyba při změně jména.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Obrázek je příliš velký. Maximum je 2MB.');
      return;
    }
    setIsUploadingPhoto(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const photoUrl = await storage.uploadUserPhoto(currentUser.id, base64);
        onUserUpdate({ ...currentUser, photoUrl });
        setIsUploadingPhoto(false);
        setSuccessMessage('Fotka byla změněna.');
        setTimeout(() => setSuccessMessage(null), 2500);
      };
      reader.onerror = () => {
        setError('Chyba při načítání obrázku.');
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError('Chyba při ukládání fotky.');
      setIsUploadingPhoto(false);
    }
  };

  const handleRemoveProfilePhoto = async () => {
    setIsUploadingPhoto(true);
    setError(null);
    try {
      await storage.deleteUserPhoto(currentUser.id);
      onUserUpdate({ ...currentUser, photoUrl: undefined });
      setIsUploadingPhoto(false);
      setSuccessMessage('Fotka byla odebrána.');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch {
      setError('Chyba při mazání fotky.');
      setIsUploadingPhoto(false);
    }
  };

  const handleCreateMyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myOwnerName.trim() || !myAccountNumber.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await storage.createBankAccount(myOwnerName, myAccountNumber, currentUser.id);
      await refreshAccounts();
      setMyAccountNumber('');
    } catch (err: any) {
      setError(err.message || 'Chyba při vytváření účtu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Settings2Icon size={20} className="text-blue-600" />
            Nastavení
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
              <Check size={16} />
              {successMessage}
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="flex justify-center py-2">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          )}

          {/* ---- PROFILE ---- */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <UserCircle size={16} className="text-blue-500" />
              Profil
            </h4>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-4">
                {/* Profile Photo */}
                <div className="relative group shrink-0">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoChange}
                    className="hidden"
                    data-testid="profile-photo-input"
                  />
                  {currentUser.photoUrl ? (
                    <img
                      src={currentUser.photoUrl}
                      alt={currentUser.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-slate-300"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl border-2 border-slate-300">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-blue-600" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="bg-blue-600 text-white rounded-full p-1 shadow-sm hover:bg-blue-700 transition-colors"
                      title="Změnit fotku"
                      data-testid="change-photo-btn"
                    >
                      <Camera size={12} />
                    </button>
                    {currentUser.photoUrl && (
                      <button
                        onClick={handleRemoveProfilePhoto}
                        disabled={isUploadingPhoto}
                        className="bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                        title="Odebrat fotku"
                        data-testid="remove-photo-btn"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                        data-testid="edit-name-input"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setIsEditingName(false); setTempName(currentUser.name); } }}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isLoading}
                        className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors"
                        data-testid="save-name-btn"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => { setIsEditingName(false); setTempName(currentUser.name); }}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate" data-testid="profile-name">{currentUser.name}</p>
                      <button
                        onClick={() => { setIsEditingName(true); setTempName(currentUser.name); }}
                        className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors shrink-0"
                        title="Upravit jméno"
                        data-testid="edit-name-btn"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">ID: {currentUser.id.slice(0, 8)}…</p>
                </div>
              </div>
            </div>
          </div>

          {/* ---- BANK ACCOUNT ---- */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Landmark size={16} className="text-blue-500" />
              Bankovní účet
            </h4>

            {myAccount ? (
              // Read-only display
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Vlastník</p>
                    <p className="font-medium text-slate-800">{myAccount.ownerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Číslo účtu</p>
                    <p className="font-mono font-medium text-slate-800">{myAccount.accountNumber}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 italic">
                  Osobní účet nelze upravit ani smazat.
                </p>
              </div>
            ) : (
              // Create form
              <form onSubmit={handleCreateMyAccount} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-slate-500">
                  Nastavte svůj bankovní účet pro příjem plateb. Účet lze nastavit pouze jednou.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Jméno vlastníka</label>
                  <input
                    type="text"
                    value={myOwnerName}
                    onChange={(e) => setMyOwnerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    placeholder="Jan Novák"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Číslo účtu</label>
                  <input
                    type="text"
                    value={myAccountNumber}
                    onChange={(e) => setMyAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                    placeholder="123456789/0100"
                    required
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                >
                  Uložit můj účet
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 space-y-2">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
          >
            Zavřít
          </button>
          {onShowChangelog && (
            <button
              onClick={() => { onClose(); onShowChangelog(); }}
              className="w-full px-4 py-2 text-slate-400 hover:text-amber-600 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles size={14} />
              Seznam změn (v1.2.0)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { BankAccount, User } from '../types';
import * as storage from '../services/storage';
import { X, Landmark, UserCircle, Loader2, AlertTriangle } from 'lucide-react';

interface BankAccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  bankAccounts: BankAccount[];
  onBankAccountsChange: (accounts: BankAccount[]) => void;
}

export const BankAccountSettingsModal: React.FC<BankAccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  bankAccounts,
  onBankAccountsChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My account form
  const [myOwnerName, setMyOwnerName] = useState(currentUser.name);
  const [myAccountNumber, setMyAccountNumber] = useState('');

  if (!isOpen) return null;

  const myAccount = bankAccounts.find(a => a.userId === currentUser.id);

  const refreshAccounts = async () => {
    const updated = await storage.getBankAccounts();
    onBankAccountsChange(updated);
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
            <Landmark size={20} className="text-blue-600" />
            Můj bankovní účet
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

          {/* Loading overlay */}
          {isLoading && (
            <div className="flex justify-center py-2">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          )}

          {/* ---- MY ACCOUNT ---- */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <UserCircle size={16} className="text-blue-500" />
              Můj účet
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
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};


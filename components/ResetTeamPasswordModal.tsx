import React, { useState, useEffect } from 'react';
import { KeyRound, X, RefreshCw, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { TeamOverviewItem } from '@/types';

interface ResetTeamPasswordModalProps {
  isOpen: boolean;
  team: TeamOverviewItem | null;
  onClose: () => void;
  onReset: (teamId: string, newPassword: string) => Promise<any>;
}

const ATHLETIC_WORDS = [
  'smec',
  'blok',
  'eso',
  'podani',
  'nahravka',
  'utok',
  'pole',
  'antena',
  'sit',
  'bagr',
  'ryba',
];

function generatePassphrase(): string {
  const word = ATHLETIC_WORDS[Math.floor(Math.random() * ATHLETIC_WORDS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

export const ResetTeamPasswordModal: React.FC<ResetTeamPasswordModalProps> = ({
  isOpen,
  team,
  onClose,
  onReset,
}) => {
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && team) {
      setPassword(generatePassphrase());
      setCopied(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, team]);

  if (!isOpen || !team) return null;

  const handleGenerate = () => {
    setPassword(generatePassphrase());
    setCopied(false);
  };

  const handleCopyMessage = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const message = `Ahoj, nové heslo pro tým "${team.name}" v aplikaci Sport Plánovač je:\n\nHeslo: ${password}\nOdkaz: ${origin}\n`;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || password.trim().length < 3) {
      setError('Heslo musí mít alespoň 3 znaky.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onReset(team.id, password.trim());
      setSuccessMessage(`Heslo pro tým "${team.name}" bylo úspěšně uloženo.`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se změnit heslo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-title"
      data-testid="reset-password-modal"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
              <KeyRound size={20} className="text-white" />
            </div>
            <div>
              <h3 id="reset-password-title" className="font-bold text-base">
                Resetovat heslo týmu
              </h3>
              <p className="text-xs text-amber-100 font-medium">Tým: {team.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Zavřít"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <span>
              Po uložení nového hesla budou členové týmu vyzváni k zadání tohoto hesla při příštím
              přihlášení.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <Check size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Nové heslo týmu
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Vygenerovat nové heslo"
                data-testid="generate-passphrase-button"
              >
                <RefreshCw size={12} />
                <span>Vygenerovat jiné</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              data-testid="new-password-input"
            />
          </div>

          <button
            type="button"
            onClick={handleCopyMessage}
            className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            data-testid="copy-captain-message-button"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Zkopírováno do schránky!</span>
              </>
            ) : (
              <>
                <Copy size={14} className="text-slate-500" />
                <span>Zkopírovat zprávu pro kapitána</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              data-testid="save-password-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Ukládám…</span>
                </>
              ) : (
                <span>Uložit nové heslo</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

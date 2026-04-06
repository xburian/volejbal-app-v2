import React from 'react';
import { SportEvent, BankAccount, maskAccountNumber } from '@/types.ts';
import { Wallet, AlertTriangle, Check, Copy, ChevronDown } from 'lucide-react';
import QRCode from 'react-qr-code';

interface PaymentSectionProps {
  event: SportEvent;
  bankAccounts: BankAccount[];
  effectiveAccountNumber: string;
  selectedAccountOwner: string;
  iban: string | null;
  qrString: string | null;
  costPerPerson: number;
  countJoined: number;
  isCopied: boolean;
  onCopyToClipboard: () => void;
  onBankAccountChange: (value: string) => void;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  event,
  bankAccounts,
  effectiveAccountNumber,
  selectedAccountOwner,
  iban,
  qrString,
  costPerPerson,
  countJoined,
  isCopied,
  onCopyToClipboard,
  onBankAccountChange,
}) => (
  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 h-fit">
    <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
      <Wallet size={20} className="text-blue-600" />
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
              onChange={(e) => onBankAccountChange(e.target.value)}
              className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm appearance-none pr-8 cursor-pointer"
            >
              <option value="" disabled>Vyberte účet...</option>
              {bankAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.ownerName} — {maskAccountNumber(a.accountNumber)}
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

        {effectiveAccountNumber && (
          <div className="mt-3 flex items-center gap-2">
            {selectedAccountOwner && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {selectedAccountOwner}
              </span>
            )}
            <p className="text-sm font-mono text-slate-700 tracking-wider select-all truncate flex-1">
              {maskAccountNumber(effectiveAccountNumber)}
            </p>
            <button
              onClick={onCopyToClipboard}
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
);


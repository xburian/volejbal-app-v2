import React from 'react';
import { Participant, User, SportConfig } from '@/types.ts';
import { Hand, AlertTriangle, Loader2, X } from 'lucide-react';
import type { ParticipantsState } from './hooks/useParticipants';
import type { PhotoUploadState } from './hooks/usePhotoUpload';

interface ParticipantListProps {
  sortedParticipants: Participant[];
  currentUser: User;
  sportConfig: SportConfig;
  countJoined: number;
  costPerPerson: number;
  isAtCapacity: boolean;
  participants: ParticipantsState;
  photoUpload: PhotoUploadState;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  sortedParticipants,
  currentUser,
  sportConfig,
  countJoined,
  costPerPerson,
  isAtCapacity,
  participants,
  photoUpload,
}) => (
  <div>
    <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center justify-between">
      <span className="flex items-center gap-2">
        Účastníci ({countJoined}/{sportConfig.maxPlayers})
        {isAtCapacity && (
          <span className="text-xs font-normal text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Plná kapacita</span>
        )}
      </span>
      <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
        {costPerPerson} Kč / os.
      </span>
    </h3>

    {photoUpload.photoError && (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
        <AlertTriangle size={16} />
        {photoUpload.photoError}
      </div>
    )}

    {participants.capacityError && (
      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
        <AlertTriangle size={16} />
        {participants.capacityError}
      </div>
    )}

    {!participants.isCurrentUserJoined && participants.currentUserParticipant?.status !== 'waitlist' && (
      <button
        onClick={() => participants.handleStatusChange(currentUser.id, 'joined')}
        disabled={participants.savingUsers.has(currentUser.id)}
        className={`w-full mb-4 py-3 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${
          isAtCapacity
            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
        }`}
      >
        {participants.savingUsers.has(currentUser.id) ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Hand size={20} />
        )}
        {isAtCapacity ? 'Na čekací listinu' : 'Jdu hrát'}
      </button>
    )}

    <div className="space-y-2">
      {sortedParticipants
        .filter(p => p.status !== 'declined' || p.userId === currentUser.id)
        .map(p => {
          const isMe = p.userId === currentUser.id;
          const isSaving = participants.savingUsers.has(p.userId);

          return (
            <div key={p.userId} className={`flex items-center justify-between p-2 border rounded-lg shadow-sm hover:shadow-md transition-shadow group ${isMe ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-8 rounded-full ${
                  p.status === 'joined' ? 'bg-green-500' :
                  p.status === 'declined' ? 'bg-red-500' :
                  p.status === 'waitlist' ? 'bg-amber-500' : 'bg-yellow-400'
                }`}></div>

                {isMe ? (
                  <div className="relative group/photo">
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={photoUpload.handlePhotoChange}
                        disabled={photoUpload.isUploadingPhoto}
                        className="hidden"
                      />
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover border-2 border-blue-400 hover:border-blue-500 transition-colors" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm border-2 border-blue-400 hover:border-blue-500 transition-colors">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {photoUpload.isUploadingPhoto && (
                        <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-blue-600" />
                        </div>
                      )}
                    </label>
                    {p.photoUrl && !photoUpload.isUploadingPhoto && (
                      <button
                        onClick={photoUpload.handleRemovePhoto}
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
                      <img src={p.photoUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover border-2 border-slate-200" />
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
                  {isMe ? (
                    <div className="flex gap-2 text-xs mt-0.5">
                      <button
                        disabled={isSaving}
                        onClick={() => participants.handleStatusChange(p.userId, 'joined')}
                        className={`hover:underline ${p.status === 'joined' ? 'font-bold text-green-600' : 'text-slate-400'}`}
                      >Jdu</button>
                      <span className="text-slate-300">|</span>
                      <button
                        disabled={isSaving}
                        onClick={() => participants.handleStatusChange(p.userId, 'declined')}
                        className={`hover:underline ${p.status === 'declined' ? 'font-bold text-red-600' : 'text-slate-400'}`}
                      >Nejdu</button>
                    </div>
                  ) : (
                    <div className="text-xs mt-0.5 font-medium text-slate-500 flex items-center gap-1">
                      {p.status === 'joined' ? 'Jde hrát' : p.status === 'declined' ? 'Nejde' : p.status === 'waitlist' ? 'Čeká na místo' : 'Možná'}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {p.status === 'joined' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none group/checkbox p-1 rounded hover:bg-slate-50 transition-colors">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin text-blue-500" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={p.hasPaid}
                          onChange={() => participants.handlePaymentToggle(p.userId, p.hasPaid)}
                          className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                        />
                      )}
                    </span>
                    <span className={`text-xs w-[4.5rem] ${p.hasPaid ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                      {p.hasPaid ? 'Zaplaceno' : 'Nezaplaceno'}
                    </span>
                  </label>
                )}
              </div>
            </div>
          );
        })}

      {sortedParticipants.length === 0 && (
        <p className="text-center text-slate-400 py-4 italic">Zatím žádní účastníci.</p>
      )}
    </div>
  </div>
);


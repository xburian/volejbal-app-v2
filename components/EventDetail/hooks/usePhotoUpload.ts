import { useState } from 'react';
import { User } from '@/types.ts';
import * as storage from '@/services/storage.ts';
import { compressImageFile } from '@/utils/imageCompression.ts';

interface UsePhotoUploadProps {
  currentUser: User;
  refreshEventData: () => Promise<void>;
}

export function usePhotoUpload({ currentUser, refreshEventData }: UsePhotoUploadProps) {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Obrázek je příliš velký. Maximum je 2MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError(null);

    try {
      const photoBase64 = await compressImageFile(file, {
        maxWidth: 160,
        maxHeight: 160,
        quality: 0.82,
      });
      await storage.uploadUserPhoto(currentUser.id, photoBase64);
      await refreshEventData();
    } catch {
      setPhotoError('Chyba při nahrávání nebo optimalizaci obrázku.');
    } finally {
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
    } catch {
      setPhotoError('Chyba při mazání obrázku.');
      setIsUploadingPhoto(false);
    }
  };

  return {
    isUploadingPhoto,
    photoError,
    handlePhotoChange,
    handleRemovePhoto,
  };
}

export type PhotoUploadState = ReturnType<typeof usePhotoUpload>;


import { useState } from 'react';
import { User } from '../../../types';
import * as storage from '../../../services/storage';

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
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoBase64 = reader.result as string;
        await storage.uploadUserPhoto(currentUser.id, photoBase64);
        await refreshEventData();
        setIsUploadingPhoto(false);
      };
      reader.onerror = () => {
        setPhotoError('Chyba při načítání obrázku.');
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setPhotoError('Chyba při ukládání obrázku.');
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


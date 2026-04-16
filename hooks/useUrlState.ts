import { useState, useEffect, useCallback } from 'react';
import { MobileView } from '@/components/MobileBottomNav';

function readFromUrl(key: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
}

function readFromStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const VALID_VIEWS: MobileView[] = ['detail', 'stats', 'changelog'];

export function useUrlState() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    () => readFromUrl('event') || readFromStorage('selectedEventId') || null,
  );

  const [mobileView, setMobileView] = useState<MobileView>(() => {
    const fromUrl = readFromUrl('view');
    if (fromUrl && VALID_VIEWS.includes(fromUrl as MobileView)) return fromUrl as MobileView;
    const saved = readFromStorage('mobileView');
    if (saved && VALID_VIEWS.includes(saved as MobileView)) return saved as MobileView;
    return 'calendar';
  });

  // Sync to URL and localStorage
  useEffect(() => {
    if (selectedEventId) {
      localStorage.setItem('selectedEventId', selectedEventId);
    } else {
      localStorage.removeItem('selectedEventId');
    }
    localStorage.setItem('mobileView', mobileView);

    const params = new URLSearchParams(window.location.search);
    if (selectedEventId) {
      params.set('event', selectedEventId);
    } else {
      params.delete('event');
    }
    if (mobileView !== 'calendar') {
      params.set('view', mobileView);
    } else {
      params.delete('view');
    }
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (newUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [selectedEventId, mobileView]);

  const clearSelection = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  return {
    selectedEventId,
    setSelectedEventId,
    clearSelection,
    mobileView,
    setMobileView,
  };
}


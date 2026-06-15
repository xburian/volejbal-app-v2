import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWeather } from './useWeather';

describe('useWeather', () => {
  const mockForecast = {
    daily: {
      temperature_2m_max: [28],
      temperature_2m_min: [16],
      weather_code: [3],
      precipitation_probability_max: [40],
    },
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-15T10:00:00'));
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns weather data for a date within forecast range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockForecast),
    }));

    const { result } = renderHook(() => useWeather('2026-06-17'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.weather).not.toBeNull();
    });

    expect(result.current.weather).toEqual({
      tempMax: 28,
      tempMin: 16,
      weatherCode: 3,
      precipChance: 40,
    });
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((fetch as any).mock.calls[0][0]).toContain('start_date=2026-06-17');
  });

  it('returns null for dates more than 16 days in the future', () => {
    const { result } = renderHook(() => useWeather('2026-07-15'));

    expect(result.current.weather).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns null for past dates (more than 1 day ago)', () => {
    const { result } = renderHook(() => useWeather('2026-06-10'));

    expect(result.current.weather).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const { result } = renderHook(() => useWeather('2026-06-17'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.weather).toBeNull();
    expect(result.current.error).toBe('HTTP 500');
  });

  it('handles network errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useWeather('2026-06-17'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.weather).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('uses cached data on subsequent calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockForecast),
    }));

    const { result, unmount } = renderHook(() => useWeather('2026-06-17'));
    await waitFor(() => expect(result.current.weather).not.toBeNull());
    expect(fetch).toHaveBeenCalledTimes(1);
    unmount();

    // Second call — should use cache
    const { result: result2 } = renderHook(() => useWeather('2026-06-17'));
    expect(result2.current.weather).toEqual({
      tempMax: 28, tempMin: 16, weatherCode: 3, precipChance: 40,
    });
    expect(result2.current.isLoading).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('allows today\'s date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockForecast),
    }));

    const { result } = renderHook(() => useWeather('2026-06-15'));

    await waitFor(() => {
      expect(result.current.weather).not.toBeNull();
    });

    expect(result.current.weather!.tempMax).toBe(28);
  });
});

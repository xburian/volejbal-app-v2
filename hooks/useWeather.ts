import { useState, useEffect, useRef } from 'react';

/** Brno, Czech Republic */
const BRNO_LAT = 49.1951;
const BRNO_LON = 16.6068;

export interface WeatherData {
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  precipChance: number;
}

/** sessionStorage cache key */
const cacheKey = (date: string) => `weather_brno_${date}`;

function getCached(date: string): WeatherData | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(date));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    // Cache valid for 1 hour
    if (Date.now() - ts < 3600_000) return data as WeatherData;
    sessionStorage.removeItem(cacheKey(date));
  } catch { /* ignore */ }
  return null;
}

function setCache(date: string, data: WeatherData) {
  try {
    sessionStorage.setItem(cacheKey(date), JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Fetch weather forecast for a given event date in Brno.
 * Only returns data when the date is within the Open-Meteo 16-day forecast window.
 * For past dates or dates too far in the future, returns null.
 */
export function useWeather(eventDate: string): {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
} {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!eventDate) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(eventDate + 'T00:00:00');

    // Open-Meteo provides up to 16 days ahead; also allow today and yesterday (for current-day events)
    const diffDays = Math.floor((target.getTime() - today.getTime()) / 86400_000);
    if (diffDays < -1 || diffDays > 16) {
      setWeather(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = getCached(eventDate);
    if (cached) {
      setWeather(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${BRNO_LAT}&longitude=${BRNO_LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Europe%2FPrague&start_date=${eventDate}&end_date=${eventDate}`;

    fetch(url, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        const d = json?.daily;
        if (d?.temperature_2m_max?.[0] == null) {
          setWeather(null);
          return;
        }
        const data: WeatherData = {
          tempMax: d.temperature_2m_max[0],
          tempMin: d.temperature_2m_min[0],
          weatherCode: d.weather_code[0],
          precipChance: d.precipitation_probability_max[0] ?? 0,
        };
        setCache(eventDate, data);
        setWeather(data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setWeather(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [eventDate]);

  return { weather, isLoading, error };
}


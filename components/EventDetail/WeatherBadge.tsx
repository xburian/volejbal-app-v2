import React from 'react';
import { WeatherData } from '@/hooks/useWeather';
import { getWeatherDescription } from '@/utils/weatherCodes';
import { Droplets, Loader2 } from 'lucide-react';

interface WeatherBadgeProps {
  weather: WeatherData | null;
  isLoading: boolean;
}

export const WeatherBadge: React.FC<WeatherBadgeProps> = ({ weather, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sky-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs">Načítám počasí…</span>
      </div>
    );
  }

  if (!weather) return null;

  const { emoji, label } = getWeatherDescription(weather.weatherCode);

  return (
    <div className="flex items-center gap-3" title={`Brno · ${label}`}>
      <span className="text-4xl leading-none select-none">{emoji}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-sm text-slate-500">
          {weather.tempMin}° / {weather.tempMax}°C
        </span>
        {weather.precipChance > 0 && (
          <span className="flex items-center gap-1 text-xs text-sky-500">
            <Droplets size={12} />
            {weather.precipChance}% srážky
          </span>
        )}
      </div>
    </div>
  );
};

/** WMO Weather interpretation codes → Czech label + emoji */
export interface WeatherDescription {
  label: string;
  emoji: string;
}

const WEATHER_CODES: Record<number, WeatherDescription> = {
  0: { label: 'Jasno', emoji: '☀️' },
  1: { label: 'Převážně jasno', emoji: '🌤️' },
  2: { label: 'Polojasno', emoji: '⛅' },
  3: { label: 'Zataženo', emoji: '☁️' },
  45: { label: 'Mlha', emoji: '🌫️' },
  48: { label: 'Mlha s námrazou', emoji: '🌫️' },
  51: { label: 'Mrholení', emoji: '🌦️' },
  53: { label: 'Mrholení', emoji: '🌦️' },
  55: { label: 'Silné mrholení', emoji: '🌧️' },
  56: { label: 'Mrznoucí mrholení', emoji: '🌧️' },
  57: { label: 'Mrznoucí mrholení', emoji: '🌧️' },
  61: { label: 'Slabý déšť', emoji: '🌦️' },
  63: { label: 'Déšť', emoji: '🌧️' },
  65: { label: 'Silný déšť', emoji: '🌧️' },
  66: { label: 'Mrznoucí déšť', emoji: '🌧️' },
  67: { label: 'Silný mrznoucí déšť', emoji: '🌧️' },
  71: { label: 'Slabé sněžení', emoji: '🌨️' },
  73: { label: 'Sněžení', emoji: '🌨️' },
  75: { label: 'Silné sněžení', emoji: '❄️' },
  77: { label: 'Sněhové krupky', emoji: '❄️' },
  80: { label: 'Přeháňky', emoji: '🌦️' },
  81: { label: 'Přeháňky', emoji: '🌧️' },
  82: { label: 'Silné přeháňky', emoji: '🌧️' },
  85: { label: 'Sněhové přeháňky', emoji: '🌨️' },
  86: { label: 'Silné sněhové přeháňky', emoji: '❄️' },
  95: { label: 'Bouřka', emoji: '⛈️' },
  96: { label: 'Bouřka s kroupami', emoji: '⛈️' },
  99: { label: 'Bouřka se silnými kroupami', emoji: '⛈️' },
};

export function getWeatherDescription(code: number): WeatherDescription {
  return WEATHER_CODES[code] ?? { label: 'Neznámé', emoji: '❓' };
}


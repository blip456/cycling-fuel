import type { WeatherData } from "./types";

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

export async function geocodeLocation(query: string): Promise<GeoResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results?.length) return null;
  return data.results[0];
}

const WMO_CODES: Record<number, { description: string; icon: WeatherData["icon"] }> = {
  0: { description: "Clear sky", icon: "sun" },
  1: { description: "Mainly clear", icon: "sun" },
  2: { description: "Partly cloudy", icon: "cloud" },
  3: { description: "Overcast", icon: "cloud" },
  45: { description: "Foggy", icon: "fog" },
  48: { description: "Icy fog", icon: "fog" },
  51: { description: "Light drizzle", icon: "rain" },
  53: { description: "Drizzle", icon: "rain" },
  55: { description: "Heavy drizzle", icon: "rain" },
  61: { description: "Slight rain", icon: "rain" },
  63: { description: "Rain", icon: "rain" },
  65: { description: "Heavy rain", icon: "rain" },
  71: { description: "Slight snow", icon: "snow" },
  73: { description: "Snow", icon: "snow" },
  75: { description: "Heavy snow", icon: "snow" },
  80: { description: "Rain showers", icon: "rain" },
  81: { description: "Rain showers", icon: "rain" },
  82: { description: "Heavy rain showers", icon: "rain" },
  95: { description: "Thunderstorm", icon: "storm" },
  96: { description: "Thunderstorm with hail", icon: "storm" },
  99: { description: "Thunderstorm with heavy hail", icon: "storm" },
};

export async function fetchWeather(
  lat: number,
  lng: number,
  date: string
): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.daily?.temperature_2m_max?.length) return null;

    const tempMax = data.daily.temperature_2m_max[0];
    const tempMin = data.daily.temperature_2m_min[0];
    const code = data.daily.weathercode[0];
    const tempC = Math.round((tempMax + tempMin) / 2);
    const weatherInfo = WMO_CODES[code] ?? { description: "Mixed", icon: "cloud" as const };

    return {
      tempC,
      description: weatherInfo.description,
      icon: weatherInfo.icon,
    };
  } catch {
    return null;
  }
}

import type { WeatherData } from "./types";

export interface GeoResult {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string; // region / state / province
}

export function formatGeoLabel(g: GeoResult): string {
  return [g.name, g.admin1, g.country].filter(Boolean).join(", ");
}

export async function searchLocations(
  query: string,
  count = 5,
  signal?: AbortSignal
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results as GeoResult[]) ?? [];
  } catch {
    return [];
  }
}

export async function geocodeLocation(query: string): Promise<GeoResult | null> {
  const results = await searchLocations(query, 1);
  return results[0] ?? null;
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weathercode&timezone=auto&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.daily?.temperature_2m_max?.length) return null;

    const tempMax = data.daily.temperature_2m_max[0];
    const tempMin = data.daily.temperature_2m_min[0];
    const tempMean = data.daily.temperature_2m_mean?.[0];
    const code = data.daily.weathercode[0];
    // Rides happen in daytime — weight toward the daily max rather than the
    // overnight minimum so hydration advice matches on-bike conditions.
    const tempC = Math.round(
      typeof tempMean === "number" ? (tempMean + tempMax) / 2 : (tempMax + tempMin) / 2
    );
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

export type CarbRatio = "1:1" | "2:1" | "single";

export type CarbRate = 30 | 45 | 60 | 90 | 120;
export const CARB_RATE_OPTIONS: readonly CarbRate[] = [30, 45, 60, 90, 120];

export type RideIntensity = "easy" | "steady" | "hard";

export interface DrinkProduct {
  id: string;
  name: string;
  brand: string;
  flavour?: string;
  scoopsRecommended: number;
  mlPerServing: number;
  carbsPerServing: number;
  carbRatio: CarbRatio;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  flavour?: string;
  carbsPerServing: number;
}

export interface Bottle {
  id: string;
  mlCapacity: 500 | 750 | 1000;
}

export interface UserProfile {
  weightKg?: number;
  defaultCarbsPerHour: CarbRate;
  defaultBottleMl: 500 | 750 | 1000;
  defaultIntensity: RideIntensity;
}

export interface WeatherData {
  tempC: number;
  description: string;
  icon: "sun" | "cloud" | "rain" | "storm" | "snow" | "fog";
}

export interface SelectedDrink {
  productId: string;
  scoopsOverride?: number;
}

export type FeedbackFeel = "too_little" | "right" | "too_much";
export type GutFeel = "fine" | "uncomfortable" | "bad";

export interface RideFeedback {
  recordedAt: string;
  carbFeel: FeedbackFeel;
  fluidFeel?: FeedbackFeel;
  gutFeel?: GutFeel;
  notes?: string;
}

export interface BottlePrep {
  bottleId: string;
  bottleIndex: number;
  mlCapacity: number;
  drinkProductId?: string; // undefined = water only
  drinkName: string;
  scoops: number;
  waterMl: number;
  carbsTotal: number;
}

export interface ScheduleItem {
  timeMin: number;
  km: number;
  drink?: {
    bottleIndex: number;
    drinkName: string;
    mlAmount: number;
    sips: number;
    carbs: number;
    bottleFinished?: boolean;
  };
  food?: {
    name: string;
    carbs: number;
  };
  cumulativeCarbs: number;
  note?: string;
}

export interface CalculatedPlan {
  durationHours: number;
  totalCarbs: number;
  totalFluidMl: number;
  bottlePrep: BottlePrep[];
  schedule: ScheduleItem[];
  preRideNote?: string;
  warnings: string[];
}

export interface FuelPlan {
  id: string;
  createdAt: string;
  rideDate: string;
  distance: number;
  avgSpeed: number;
  location: string;
  lat?: number;
  lng?: number;
  weather?: WeatherData;
  carbsPerHour: CarbRate;
  intensity?: RideIntensity;
  bottles: Bottle[];
  includeSolidFood: boolean;
  selectedDrinks: SelectedDrink[];
  selectedFoods: string[];
  result?: CalculatedPlan;
  feedback?: RideFeedback;
}

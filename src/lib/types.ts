export type CarbRatio = "1:1" | "2:1" | "single";

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
  defaultCarbsPerHour: 45 | 60 | 90 | 120;
  defaultBottleMl: 500 | 750 | 1000;
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
    carbs: number;
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
  carbsPerHour: 45 | 60 | 90 | 120;
  bottles: Bottle[];
  includeSolidFood: boolean;
  selectedDrinks: SelectedDrink[];
  selectedFoods: string[];
  result?: CalculatedPlan;
}

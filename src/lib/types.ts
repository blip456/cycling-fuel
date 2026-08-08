export type CarbRatio = "1:1" | "2:1" | "single";

// Finer granularity in the 60–90 g/hr "gut training" zone so riders (and the
// feedback loop) can nudge intake in realistic 10g steps instead of leaping
// 60 → 90. Above 90 stays coarse (racing territory, opt-in only).
export type CarbRate = 30 | 45 | 60 | 70 | 80 | 90 | 120;
export const CARB_RATE_OPTIONS: readonly CarbRate[] = [30, 45, 60, 70, 80, 90, 120];

export type RideIntensity = "easy" | "steady" | "hard";

// Food behaves differently in the gut: fast fuel (gels/chews) empties quickly
// and can be spaced closer together; bars and real food need a longer window.
export type FoodType = "gel" | "chew" | "bar" | "real";

// Minimum spacing (minutes) between two solid items of this type — driven by
// how long each typically takes to clear the stomach. Fast carbs sit like a
// drink; a bar or sandwich needs the classic ~45–50 min.
export const FOOD_GAP_MIN: Record<FoodType, number> = {
  gel: 25,
  chew: 30,
  bar: 45,
  real: 50,
};

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  gel: "Gel",
  chew: "Chew / block",
  bar: "Bar",
  real: "Real food",
};

// Bottle/vessel sizes: soft flasks through hydration packs.
export const BOTTLE_SIZE_OPTIONS: readonly number[] = [250, 500, 600, 750, 1000, 1500, 2000];

export interface DrinkProduct {
  id: string;
  name: string;
  brand: string;
  flavour?: string;
  scoopsRecommended: number;
  mlPerServing: number;
  carbsPerServing: number;
  carbRatio: CarbRatio;
  sodiumMgPerServing?: number;
  caffeineMgPerServing?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  flavour?: string;
  carbsPerServing: number;
  type?: FoodType; // undefined treated as "bar" (conservative spacing)
  sodiumMg?: number;
  caffeineMg?: number;
}

export interface Bottle {
  id: string;
  mlCapacity: number;
}

// A logged sweat-rate test: weigh in before, weigh out after, note what you
// drank. rate = ((before − after) L + drunk L) ÷ hours.
export interface SweatTest {
  recordedAt: string;
  durationMin: number;
  weightBeforeKg: number;
  weightAfterKg: number;
  fluidDrunkMl: number;
  tempC?: number;
  sweatRateMlPerHour: number;
}

export interface UserProfile {
  weightKg?: number;
  defaultCarbsPerHour: CarbRate;
  defaultBottleMl: number;
  defaultIntensity: RideIntensity;
  // Personal sweat rate (ml/hr). When set, overrides the weather baseline.
  sweatRateMlPerHour?: number;
  sweatTests?: SweatTest[];
}

export interface WeatherData {
  tempC: number;
  description: string;
  icon: "sun" | "cloud" | "rain" | "storm" | "snow" | "fog";
  manual?: boolean; // temperature entered by hand rather than fetched
  fetchedAt?: string; // when this forecast was pulled (rides planned weeks out drift)
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
  sodiumMg?: number;
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
  refill?: boolean; // a "refill your bottles (with water)" checkpoint
}

export interface CalculatedPlan {
  durationHours: number;
  totalCarbs: number;
  totalFluidMl: number;
  bottlePrep: BottlePrep[];
  schedule: ScheduleItem[];
  preRideNote?: string;
  recoveryNote?: string;
  caffeineNote?: string;
  sodiumTargetMg?: number;
  sodiumDeliveredMg?: number;
  fluidPerHourMl: number;
  fluidSource: "sweat-test" | "weather";
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
  // The forecast `result` was actually calculated from. It only drifts away
  // from `weather` when a refresh lands on a locked plan — that gap is what
  // powers the "here's what would change" banner without touching the plan.
  calcWeather?: WeatherData;
  // Locked plans never change on their own: a weather refresh updates the
  // forecast and shows the impact, but leaves the schedule exactly as it is.
  locked?: boolean;
  lockedAt?: string;
  carbsPerHour: CarbRate;
  intensity?: RideIntensity;
  bottles: Bottle[];
  includeSolidFood: boolean;
  includeCaffeine?: boolean;
  selectedDrinks: SelectedDrink[];
  selectedFoods: string[];
  result?: CalculatedPlan;
  feedback?: RideFeedback;
}

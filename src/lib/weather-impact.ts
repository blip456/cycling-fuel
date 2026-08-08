import { calculateFuelPlan } from "./fuel-calculator";
import type {
  CalculatedPlan,
  DrinkProduct,
  FoodItem,
  FuelPlan,
  UserProfile,
  WeatherData,
} from "./types";

export interface CalcDeps {
  drinks: DrinkProduct[];
  foods: FoodItem[];
  profile: UserProfile;
}

// Two forecasts count as "the same plan input" when the numbers the calculator
// reads from them match. A reworded description alone shouldn't nag the rider.
export function sameWeatherInputs(a?: WeatherData, b?: WeatherData): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.tempC === b.tempC;
}

// Re-run a plan against a forecast while keeping the rider's own bottle setup
// (chosen drink + scoops per bottle). Only the weather-driven numbers — fluid,
// sodium, and the food that fills whatever carb gap is left — move.
export function recalcPlanForWeather(
  plan: FuelPlan,
  weather: WeatherData | undefined,
  { drinks, foods, profile }: CalcDeps
): CalculatedPlan {
  const bottleSetup = plan.result?.bottlePrep.map((b) => ({
    bottleId: b.bottleId,
    mlCapacity: b.mlCapacity,
    drinkProductId: b.drinkProductId ?? null,
    scoops: b.scoops,
  }));

  return calculateFuelPlan({
    distance: plan.distance,
    avgSpeed: plan.avgSpeed,
    carbsPerHour: plan.carbsPerHour,
    bottles: plan.bottles,
    includeSolidFood: plan.includeSolidFood,
    includeCaffeine: plan.includeCaffeine,
    selectedDrinks: plan.selectedDrinks,
    selectedFoods: plan.selectedFoods,
    drinks,
    foods,
    weather,
    weightKg: profile.weightKg,
    intensity: plan.intensity,
    sweatRateMlPerHour: profile.sweatRateMlPerHour,
    fuelAnchor: plan.fuelAnchor,
    ...(bottleSetup && bottleSetup.length > 0 ? { bottleSetup } : {}),
  });
}

export interface WeatherImpact {
  from?: WeatherData; // forecast the saved plan was built on
  to?: WeatherData; // forecast now on file
  fluidPerHourFrom: number;
  fluidPerHourTo: number;
  totalFluidFrom: number;
  totalFluidTo: number;
  fluidDiffMl: number;
  sodiumTargetFrom: number;
  sodiumTargetTo: number;
  foodItemsFrom: number;
  foodItemsTo: number;
  newWarnings: string[];
  /** True when the new forecast wouldn't move a single number in the plan. */
  noChange: boolean;
  /** What the plan would become if the rider applies the new forecast. */
  result: CalculatedPlan;
}

// The gap between "what the plan says" and "what the current forecast implies".
// Returns null when the plan is already in sync with its forecast.
export function weatherImpact(plan: FuelPlan, deps: CalcDeps): WeatherImpact | null {
  const current = plan.result;
  if (!current) return null;
  if (sameWeatherInputs(plan.weather, plan.calcWeather)) return null;

  const result = recalcPlanForWeather(plan, plan.weather, deps);
  const foodItemsFrom = current.schedule.filter((s) => s.food).length;
  const foodItemsTo = result.schedule.filter((s) => s.food).length;
  const newWarnings = result.warnings.filter((w) => !current.warnings.includes(w));

  return {
    from: plan.calcWeather,
    to: plan.weather,
    fluidPerHourFrom: current.fluidPerHourMl,
    fluidPerHourTo: result.fluidPerHourMl,
    totalFluidFrom: current.totalFluidMl,
    totalFluidTo: result.totalFluidMl,
    fluidDiffMl: result.totalFluidMl - current.totalFluidMl,
    sodiumTargetFrom: current.sodiumTargetMg ?? 0,
    sodiumTargetTo: result.sodiumTargetMg ?? 0,
    foodItemsFrom,
    foodItemsTo,
    newWarnings,
    noChange:
      result.totalFluidMl === current.totalFluidMl &&
      (result.sodiumTargetMg ?? 0) === (current.sodiumTargetMg ?? 0) &&
      foodItemsFrom === foodItemsTo &&
      newWarnings.length === 0,
    result,
  };
}

// One-line summary of the hydration change, for banners and toasts.
export function describeImpact(impact: WeatherImpact): string {
  if (impact.noChange) {
    return "Your fuelling and hydration work out the same either way — nothing to change.";
  }
  const parts: string[] = [];
  if (impact.fluidDiffMl !== 0) {
    const more = impact.fluidDiffMl > 0;
    parts.push(
      `${more ? "+" : "−"}${Math.abs(impact.fluidDiffMl)}ml water (${(impact.totalFluidTo / 1000).toFixed(1)}L total, ` +
        `${impact.fluidPerHourTo}ml/hr instead of ${impact.fluidPerHourFrom}ml/hr)`
    );
  }
  const sodiumDiff = impact.sodiumTargetTo - impact.sodiumTargetFrom;
  if (sodiumDiff !== 0) {
    parts.push(`${sodiumDiff > 0 ? "+" : "−"}${Math.abs(sodiumDiff)}mg sodium lost to sweat`);
  }
  const foodDiff = impact.foodItemsTo - impact.foodItemsFrom;
  if (foodDiff !== 0) {
    parts.push(`${foodDiff > 0 ? "+" : "−"}${Math.abs(foodDiff)} food item${Math.abs(foodDiff) !== 1 ? "s" : ""}`);
  }
  if (parts.length === 0) return "The updated forecast shifts a few details of the plan.";
  return parts.join(" · ");
}

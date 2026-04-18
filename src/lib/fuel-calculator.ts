import type {
  Bottle,
  BottlePrep,
  CalculatedPlan,
  DrinkProduct,
  FoodItem,
  ScheduleItem,
  SelectedDrink,
  WeatherData,
} from "./types";

interface CalcInputs {
  distance: number;
  avgSpeed: number;
  carbsPerHour: 45 | 60 | 90 | 120;
  bottles: Bottle[];
  includeSolidFood: boolean;
  selectedDrinks: SelectedDrink[];
  selectedFoods: string[];
  drinks: DrinkProduct[];
  foods: FoodItem[];
  weather?: WeatherData;
  weightKg?: number;
}

function getWeatherFluidMlPerHour(weather?: WeatherData): number {
  if (!weather) return 500;
  if (weather.tempC < 15) return 400;
  if (weather.tempC < 25) return 500;
  return 650;
}

function getFirstFeedMin(durationHours: number): number {
  if (durationHours < 1) return Infinity;
  if (durationHours < 1.5) return 30;
  if (durationHours < 3) return 15;
  return 10;
}

function getCarbsHourTip(carbsPerHour: number): string {
  if (carbsPerHour <= 60) return "Suitable for rides under 2 hours. Single carb source is fine.";
  if (carbsPerHour <= 90) return "Ideal for 2–4hr rides. Mixed carb sources (glucose + fructose) improve absorption.";
  return "For long or intense rides. Requires gut training and a 1:1 glucose:fructose ratio.";
}

export function calculateFuelPlan(inputs: CalcInputs): CalculatedPlan {
  const { distance, avgSpeed, carbsPerHour, bottles, includeSolidFood, weather, weightKg } = inputs;

  const durationHours = distance / avgSpeed;
  const durationMin = Math.round(durationHours * 60);
  const totalCarbs = Math.round(durationHours * carbsPerHour);
  const fluidMlPerHour = getWeatherFluidMlPerHour(weather);
  const totalFluidMl = Math.round(durationHours * fluidMlPerHour);

  const activeDrinks = inputs.selectedDrinks
    .map((sd) => ({
      sd,
      product: inputs.drinks.find((d) => d.id === sd.productId),
    }))
    .filter((x): x is { sd: SelectedDrink; product: DrinkProduct } => !!x.product);

  const activeFoods = inputs.selectedFoods
    .map((id) => inputs.foods.find((f) => f.id === id))
    .filter((f): f is FoodItem => !!f);

  // Build bottle prep - assign drinks to bottles in rotation
  const bottlePrep: BottlePrep[] = bottles.map((bottle, i) => {
    const drinkEntry = activeDrinks.length > 0
      ? activeDrinks[i % activeDrinks.length]
      : null;

    if (!drinkEntry) {
      return {
        bottleId: bottle.id,
        bottleIndex: i + 1,
        mlCapacity: bottle.mlCapacity,
        drinkName: "Water",
        scoops: 0,
        waterMl: bottle.mlCapacity,
        carbsTotal: 0,
      };
    }

    const { product, sd } = drinkEntry;
    const scoops = sd.scoopsOverride ?? product.scoopsRecommended;
    // Scale scoops proportionally to bottle size vs serving size
    const scaledScoops = Math.round((bottle.mlCapacity / product.mlPerServing) * scoops);
    const carbsTotal = Math.round((scaledScoops / product.scoopsRecommended) * product.carbsPerServing);
    const waterMl = Math.round(bottle.mlCapacity * 0.95); // leave room for powder

    return {
      bottleId: bottle.id,
      bottleIndex: i + 1,
      mlCapacity: bottle.mlCapacity,
      drinkName: product.flavour ? `${product.name} (${product.flavour})` : product.name,
      scoops: scaledScoops,
      waterMl,
      carbsTotal,
    };
  });

  const totalDrinkCarbs = bottlePrep.reduce((sum, b) => sum + b.carbsTotal, 0);
  const foodCarbsNeeded = Math.max(0, totalCarbs - totalDrinkCarbs);

  // Build feeding schedule
  const firstFeedMin = getFirstFeedMin(durationHours);
  const schedule: ScheduleItem[] = [];
  let cumulativeCarbs = 0;

  if (firstFeedMin === Infinity) {
    // Short ride - just show a single water reminder halfway
    const midMin = Math.round(durationMin / 2);
    schedule.push({
      timeMin: midMin,
      km: Math.round((midMin / 60) * avgSpeed),
      cumulativeCarbs: 0,
      note: "Sip water as needed",
    });
  } else {
    // Calculate drink distribution: spread ml across intervals
    const intervals: number[] = [];
    for (let t = firstFeedMin; t < durationMin; t += 20) {
      intervals.push(t);
    }

    // Track remaining ml per bottle and food items
    const remainingMl = bottlePrep.map((b) => b.mlCapacity);
    const totalBottleMl = remainingMl.reduce((a, b) => a + b, 0);
    const mlPerInterval = totalBottleMl > 0 ? Math.round(totalBottleMl / intervals.length) : 0;
    let currentBottleIdx = 0;

    // Spread food across intervals
    let foodCarbsAssigned = 0;
    const foodSchedule: Array<FoodItem | null> = intervals.map((_, i) => {
      if (!includeSolidFood || activeFoods.length === 0) return null;
      // Add food at every 2nd interval, starting from 2nd
      if (i % 2 === 1 && foodCarbsAssigned < foodCarbsNeeded) {
        const food = activeFoods[Math.floor(i / 2) % activeFoods.length];
        foodCarbsAssigned += food.carbsPerServing;
        return food;
      }
      return null;
    });

    intervals.forEach((timeMin, i) => {
      const km = Math.round((timeMin / 60) * avgSpeed);
      const food = foodSchedule[i];

      // Drink from current bottle
      let drinkInfo: ScheduleItem["drink"] | undefined;
      if (bottlePrep.length > 0 && mlPerInterval > 0) {
        // Move to next bottle if current is empty
        while (currentBottleIdx < bottlePrep.length - 1 && remainingMl[currentBottleIdx] <= 0) {
          currentBottleIdx++;
        }
        const b = bottlePrep[currentBottleIdx];
        const drinkMl = Math.min(mlPerInterval, remainingMl[currentBottleIdx]);
        remainingMl[currentBottleIdx] -= drinkMl;

        if (drinkMl > 0 && b.drinkName !== "Water") {
          const carbFromDrink = b.carbsTotal > 0
            ? Math.round((drinkMl / b.mlCapacity) * b.carbsTotal)
            : 0;
          cumulativeCarbs += carbFromDrink;
          drinkInfo = {
            bottleIndex: b.bottleIndex,
            drinkName: b.drinkName.split(" (")[0],
            mlAmount: drinkMl,
            carbs: carbFromDrink,
          };
        } else if (drinkMl > 0) {
          drinkInfo = {
            bottleIndex: b.bottleIndex,
            drinkName: "Water",
            mlAmount: drinkMl,
            carbs: 0,
          };
        }
      }

      if (food) {
        cumulativeCarbs += food.carbsPerServing;
      }

      schedule.push({
        timeMin,
        km,
        drink: drinkInfo,
        food: food ? { name: food.name, carbs: food.carbsPerServing } : undefined,
        cumulativeCarbs,
      });
    });
  }

  // Warnings
  const warnings: string[] = [];
  if (carbsPerHour > 60 && activeDrinks.some((ad) => ad.product.carbRatio === "single")) {
    warnings.push("You're targeting >60g carbs/hr with a single-source carb drink. Consider a drink with glucose + fructose (1:1 or 2:1 ratio) to avoid GI distress.");
  }
  if (carbsPerHour >= 90 && activeDrinks.some((ad) => ad.product.carbRatio === "1:1")) {
    warnings.push("For 90g+/hr, a 2:1 glucose:fructose ratio is recommended for better gut absorption.");
  }
  if (weather && weather.tempC > 25) {
    warnings.push(`Hot conditions (${weather.tempC}°C) — increase fluid intake. Make sure all bottles are full.`);
  }
  if (totalDrinkCarbs < totalCarbs * 0.4 && !includeSolidFood) {
    warnings.push("Your drinks only cover part of your carb target. Consider adding solid food or enabling solid food in the plan.");
  }

  // Pre-ride note
  let preRideNote: string | undefined;
  if (weightKg && durationHours >= 1.5) {
    const carbLoadG = Math.round(weightKg * 2);
    preRideNote = `Pre-ride (3–4hrs before): eat ~${carbLoadG}g carbs (~${Math.round(weightKg * 2)}g based on your weight). Think oats, rice, banana, toast.`;
  }

  return {
    durationHours,
    totalCarbs,
    totalFluidMl,
    bottlePrep,
    schedule,
    preRideNote,
    warnings,
  };
}

export { getCarbsHourTip };

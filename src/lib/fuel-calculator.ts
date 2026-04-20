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

function getFirstDrinkMin(durationHours: number): number {
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

  // --- Bottle prep (what to mix tonight) ---
  const bottlePrep: BottlePrep[] = bottles.map((bottle, i) => {
    const drinkEntry = activeDrinks.length > 0 ? activeDrinks[i % activeDrinks.length] : null;

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
    const scaledScoops = Math.round((bottle.mlCapacity / product.mlPerServing) * scoops);
    const carbsTotal = Math.round((scaledScoops / product.scoopsRecommended) * product.carbsPerServing);

    return {
      bottleId: bottle.id,
      bottleIndex: i + 1,
      mlCapacity: bottle.mlCapacity,
      drinkProductId: product.id,
      drinkName: product.flavour ? `${product.name} (${product.flavour})` : product.name,
      scoops: scaledScoops,
      waterMl: bottle.mlCapacity,
      carbsTotal,
    };
  });

  // --- Full-ride drink carbs (accounts for bottle refills) ---
  // On rides longer than your bottle capacity, you refill at feed zones.
  // Scale initial bottle carbs by how many sets of bottles are consumed.
  const initialBottleMl = bottles.reduce((sum, b) => sum + b.mlCapacity, 0);
  const initialDrinkCarbs = bottlePrep.reduce((sum, b) => sum + b.carbsTotal, 0);
  const bottleSets = initialBottleMl > 0 ? totalFluidMl / initialBottleMl : 1;
  const fullRideDrinkCarbs = Math.round(initialDrinkCarbs * bottleSets);

  // --- Solid food: fills only the remaining carb gap ---
  // Science: solid food every ~50 min is realistic. More frequent causes GI stress.
  // Feed window starts at 30-45 min (body needs warmup) and ends 20 min before finish.
  const foodCarbsGap = Math.max(0, totalCarbs - fullRideDrinkCarbs);

  // FIX 1: feedStartMin must be at least 30 min — body needs warmup before solid food
  const feedStartMin = Math.max(30, Math.min(45, Math.round(durationMin * 0.15)));
  const feedEndMin = Math.max(feedStartMin + 1, durationMin - 20);
  const feedWindowMin = feedEndMin - feedStartMin;

  // One solid item per 50 minutes is the ceiling (science-backed realistic maximum)
  const maxFoodItems = Math.max(0, Math.floor(feedWindowMin / 50));

  let foodItemCount = 0;
  if (includeSolidFood && activeFoods.length > 0 && foodCarbsGap > 5) {
    const avgFoodCarbs =
      activeFoods.reduce((s, f) => s + f.carbsPerServing, 0) / activeFoods.length;
    const itemsNeededForGap = Math.ceil(foodCarbsGap / avgFoodCarbs);
    foodItemCount = Math.min(itemsNeededForGap, maxFoodItems);
  }

  // FIX 2: fixed 50-min steps guarantee exactly 50 min between items (not proportional)
  const foodEventTimes: number[] = [];
  for (let i = 1; i <= foodItemCount; i++) {
    foodEventTimes.push(feedStartMin + i * 50);
  }

  // --- Build feeding schedule ---
  const firstDrinkMin = getFirstDrinkMin(durationHours);
  const schedule: ScheduleItem[] = [];
  let cumulativeCarbs = 0;

  if (firstDrinkMin === Infinity) {
    // Very short ride: water only
    const midMin = Math.round(durationMin / 2);
    schedule.push({
      timeMin: midMin,
      km: Math.round((midMin / 60) * avgSpeed),
      cumulativeCarbs: 0,
      note: "Sip water as needed",
    });
  } else {
    // Drink intervals every 20 min
    const drinkIntervals: number[] = [];
    for (let t = firstDrinkMin; t < durationMin; t += 20) {
      drinkIntervals.push(t);
    }

    // Snap each food event to its nearest drink interval
    // (avoids events that are only a few minutes apart)
    const foodByInterval = new Map<number, FoodItem>();
    foodEventTimes.forEach((foodTime, i) => {
      const nearest = drinkIntervals.reduce((best, t) =>
        Math.abs(t - foodTime) < Math.abs(best - foodTime) ? t : best
      );
      // Don't overwrite if already assigned; push to next available interval instead
      if (!foodByInterval.has(nearest)) {
        foodByInterval.set(nearest, activeFoods[i % activeFoods.length]);
      } else {
        // Find the next available interval after nearest
        const later = drinkIntervals.find((t) => t > nearest && !foodByInterval.has(t));
        if (later !== undefined) {
          foodByInterval.set(later, activeFoods[i % activeFoods.length]);
        }
      }
    });

    // Sip-based fluid distribution (1 sip = 50ml, science-backed mouthful size)
    const SIP_ML = 50;
    const totalBottleMl = bottlePrep.reduce((sum, b) => sum + b.mlCapacity, 0);
    const totalSips = Math.round(totalBottleMl / SIP_ML);
    const sipsPerBottle = bottlePrep.map((b) => Math.round(b.mlCapacity / SIP_ML));
    const remainingBottleSips = [...sipsPerBottle];
    // FIX 3: running-total carb tracking per bottle eliminates per-sip rounding drift.
    // carbsAssigned[i] tracks how many grams have been attributed to bottle i so far.
    // Each chunk's carbs = round(sipsAfter/totalSips × carbsTotal) - carbsAssigned[i]
    // so the last chunk always brings the bottle's total to exactly carbsTotal.
    const carbsAssigned = new Array(bottlePrep.length).fill(0);
    let currentBottleIdx = 0;
    let cumulativeSipsAssigned = 0;

    drinkIntervals.forEach((timeMin, idx) => {
      const km = Math.round((timeMin / 60) * avgSpeed);
      const food = foodByInterval.get(timeMin) ?? null;

      // Advance past empty bottles
      while (currentBottleIdx < bottlePrep.length - 1 && remainingBottleSips[currentBottleIdx] <= 0) {
        currentBottleIdx++;
      }

      // Cumulative rounding: how many sips should have been drunk by end of this interval?
      const targetCumSips =
        drinkIntervals.length > 0
          ? Math.round((totalSips * (idx + 1)) / drinkIntervals.length)
          : 0;
      const sipsNeeded = Math.max(0, targetCumSips - cumulativeSipsAssigned);

      // Assign sips — may span across bottle boundary
      let sipsLeft = sipsNeeded;
      let intervalCarbs = 0;
      let bottleFinished = false;
      const startBottleIdx = currentBottleIdx;

      while (sipsLeft > 0 && currentBottleIdx < bottlePrep.length) {
        const fromThisBottle = Math.min(sipsLeft, remainingBottleSips[currentBottleIdx]);
        if (fromThisBottle > 0) {
          const bi = currentBottleIdx;
          const b = bottlePrep[bi];
          const sipsDrunkBefore = sipsPerBottle[bi] - remainingBottleSips[bi];
          const sipsDrunkAfter = sipsDrunkBefore + fromThisBottle;
          const targetCarbsAfter =
            sipsPerBottle[bi] > 0
              ? Math.round((sipsDrunkAfter / sipsPerBottle[bi]) * b.carbsTotal)
              : 0;
          const chunkCarbs = targetCarbsAfter - carbsAssigned[bi];
          carbsAssigned[bi] = targetCarbsAfter;
          intervalCarbs += chunkCarbs;
          remainingBottleSips[bi] -= fromThisBottle;
          sipsLeft -= fromThisBottle;
        }
        if (remainingBottleSips[currentBottleIdx] <= 0 && currentBottleIdx < bottlePrep.length - 1) {
          bottleFinished = true;
          currentBottleIdx++;
        } else {
          break;
        }
      }

      const actualSips = sipsNeeded - sipsLeft;
      cumulativeSipsAssigned += actualSips;

      let drinkInfo: ScheduleItem["drink"] | undefined;
      if (actualSips > 0 && bottlePrep.length > 0) {
        const b = bottlePrep[startBottleIdx];
        drinkInfo = {
          bottleIndex: b.bottleIndex,
          drinkName: b.drinkName === "Water" ? "Water" : b.drinkName.split(" (")[0],
          mlAmount: actualSips * SIP_ML,
          sips: actualSips,
          carbs: intervalCarbs,
          ...(bottleFinished ? { bottleFinished: true } : {}),
        };
      }

      if (food) {
        cumulativeCarbs += food.carbsPerServing;
      }
      cumulativeCarbs += intervalCarbs;

      schedule.push({
        timeMin,
        km,
        drink: drinkInfo,
        food: food ? { name: food.name, carbs: food.carbsPerServing } : undefined,
        cumulativeCarbs,
      });
    });
  }

  // --- Warnings ---
  const warnings: string[] = [];
  if (carbsPerHour > 60 && activeDrinks.some((ad) => ad.product.carbRatio === "single")) {
    warnings.push(
      "You're targeting >60g carbs/hr with a single-source carb drink. Consider a drink with glucose + fructose (1:1 or 2:1 ratio) to avoid GI distress."
    );
  }
  if (carbsPerHour >= 120 && activeDrinks.length > 0 &&
      activeDrinks.every((ad) => ad.product.carbRatio !== "1:1")) {
    warnings.push(
      "At 120g/hr, a 1:1 glucose:fructose drink fully saturates both SGLT1 and GLUT5 transporters. A 2:1 ratio starts to bottleneck at this intake level."
    );
  }
  if (weather && weather.tempC > 25) {
    warnings.push(
      `Hot conditions (${weather.tempC}°C) — increase fluid intake. Make sure all bottles are full.`
    );
  }
  if (bottleSets > 1.5) {
    const refills = Math.ceil(bottleSets) - 1;
    warnings.push(
      `This ride requires ~${refills} bottle refill${refills > 1 ? "s" : ""}. Plan for a feed zone or carry extra nutrition.`
    );
  }
  if (fullRideDrinkCarbs < totalCarbs * 0.5 && !includeSolidFood) {
    warnings.push(
      "Your drinks alone may not cover your carb target. Consider enabling solid food or adding a carb-rich drink."
    );
  }

  // --- Pre-ride note ---
  let preRideNote: string | undefined;
  if (weightKg && durationHours >= 1.5) {
    const carbLoadG = Math.round(weightKg * 2);
    preRideNote = `Pre-ride (3–4hrs before): eat ~${carbLoadG}g carbs (~${carbLoadG}g based on your weight). Think oats, rice, banana, toast.`;
  }

  // Bottle carbs + food carbs = exact total without per-sip rounding errors
  const actualCarbs =
    bottlePrep.reduce((sum, b) => sum + b.carbsTotal, 0) +
    schedule.reduce((sum, s) => sum + (s.food?.carbs ?? 0), 0);

  return {
    durationHours,
    totalCarbs: actualCarbs,
    totalFluidMl,
    bottlePrep,
    schedule,
    preRideNote,
    warnings,
  };
}

export { getCarbsHourTip };

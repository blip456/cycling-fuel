import { FOOD_GAP_MIN } from "./types";
import type {
  Bottle,
  BottlePrep,
  CalculatedPlan,
  CarbRate,
  DrinkProduct,
  FoodItem,
  FuelAnchor,
  RideIntensity,
  ScheduleItem,
  SelectedDrink,
  WeatherData,
} from "./types";

// Explicit per-bottle prep — used when recalculating from an edited plan where
// the rider has set each bottle's drink and scoops individually (finer than the
// wizard's product-level model). When present it drives bottlePrep directly.
export interface BottleSetup {
  bottleId?: string;
  mlCapacity: number;
  drinkProductId: string | null;
  scoops: number;
}

interface CalcInputs {
  distance: number;
  avgSpeed: number;
  carbsPerHour: CarbRate;
  bottles: Bottle[];
  includeSolidFood: boolean;
  includeCaffeine?: boolean;
  selectedDrinks: SelectedDrink[];
  selectedFoods: string[];
  drinks: DrinkProduct[];
  foods: FoodItem[];
  weather?: WeatherData;
  weightKg?: number;
  intensity?: RideIntensity;
  sweatRateMlPerHour?: number;
  // When provided, bottlePrep is built from this exact setup (drink + scoops
  // per bottle) instead of cycling selectedDrinks across `bottles`.
  bottleSetup?: BottleSetup[];
  // Optional per-hour rhythm ("a bottle an hour", "a bar an hour") that decides
  // one side of the plan before anything else. See resolveAnchor below.
  fuelAnchor?: FuelAnchor;
}

// Hard ceiling on anchored items so a silly perHour can't generate a hundred
// bottles on an all-day ride.
const MAX_ANCHOR_ITEMS = 24;
// How far above a drink's normal concentration we'll mix to reach a carb
// target when food sets the rhythm. Beyond this it stops being drinkable.
const MAX_CONCENTRATION_FACTOR = 1.5;

// Mid-range sweat sodium concentration (mg per litre of sweat). Individual
// sweat runs anywhere from ~400 (light salty) to ~1500+ (very salty); 800 is a
// reasonable planning midpoint for a target.
const SWEAT_SODIUM_MG_PER_L = 800;

function weatherFluidMlPerHour(weather?: WeatherData): number {
  if (!weather) return 500;
  if (weather.tempC < 15) return 400;
  if (weather.tempC < 25) return 500;
  return 650;
}

// Fluid need per hour. A logged personal sweat rate always wins over the
// weather baseline (it's measured from *you*); we still nudge it up in real
// heat since most sweat tests are done in cooler conditions.
function resolveFluidPerHour(
  sweatRateMlPerHour: number | undefined,
  weather: WeatherData | undefined
): { perHour: number; source: CalculatedPlan["fluidSource"] } {
  if (sweatRateMlPerHour && sweatRateMlPerHour > 0) {
    let ml = sweatRateMlPerHour;
    if (weather && weather.tempC >= 25) ml = Math.round(ml * 1.1);
    return { perHour: ml, source: "sweat-test" };
  }
  return { perHour: weatherFluidMlPerHour(weather), source: "weather" };
}

function getFirstDrinkMin(durationHours: number): number {
  if (durationHours < 1) return Infinity;
  if (durationHours < 1.5) return 30;
  if (durationHours < 3) return 15;
  return 10;
}

function getCarbsHourTip(carbsPerHour: number): string {
  if (carbsPerHour <= 30) return "Easy / leisure pace. A light mix or one snack per hour covers it.";
  if (carbsPerHour <= 60) return "Suitable for rides up to ~2–3 hours. A single carb source is fine.";
  if (carbsPerHour <= 80) return "Gut-training zone. Use a glucose + fructose (2:1) mix and build up gradually.";
  if (carbsPerHour <= 90) return "Hard 2–4hr rides. Mixed carb sources (glucose + fructose) improve absorption.";
  return "Racing intakes. Requires gut training and a 1:1 glucose:fructose ratio.";
}

function foodGap(f: FoodItem): number {
  return FOOD_GAP_MIN[f.type ?? "bar"];
}

// Rhythm beats optimal spacing: the rider asked for "one an hour", so spread
// exactly that many items evenly across the feed window.
function anchoredFoodTimes(count: number, startMin: number, endMin: number): number[] {
  if (count <= 0 || endMin < startMin) return [];
  if (count === 1) return [startMin];
  const gap = (endMin - startMin) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(startMin + i * gap));
}

// "1", "1.5", "0.5" — no trailing zeroes on whole numbers.
function fmtRate(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export function calculateFuelPlan(inputs: CalcInputs): CalculatedPlan {
  const { distance, avgSpeed, carbsPerHour, bottles, includeSolidFood, weather, weightKg } = inputs;

  const durationHours = distance / avgSpeed;
  const durationMin = Math.round(durationHours * 60);
  const totalCarbs = Math.round(durationHours * carbsPerHour);

  const activeDrinks = inputs.selectedDrinks
    .map((sd) => ({
      sd,
      product: inputs.drinks.find((d) => d.id === sd.productId),
    }))
    .filter((x): x is { sd: SelectedDrink; product: DrinkProduct } => !!x.product);

  const activeFoods = inputs.selectedFoods
    .map((id) => inputs.foods.find((f) => f.id === id))
    .filter((f): f is FoodItem => !!f);

  // Feed window: warmup at the start, cutoff 20 min before finish.
  const feedStartMin = Math.max(30, Math.min(45, Math.round(durationMin * 0.15)));
  const feedEndMin = durationMin - 20;

  // --- Step 0: the fueling rhythm ------------------------------------------
  // Before anything else, an optional rhythm fixes one side of the plan: N
  // bottles of mix per hour, or N solid items per hour. The other side then
  // fills whatever carbs are left. Without it, everything below behaves as it
  // always has — bottles as configured, food filling the gap.
  const anchor = inputs.fuelAnchor && inputs.fuelAnchor.perHour > 0 ? inputs.fuelAnchor : undefined;
  const anchorCount = anchor
    ? Math.max(1, Math.min(MAX_ANCHOR_ITEMS, Math.round(durationHours * anchor.perHour)))
    : 0;
  // An explicit bottle setup (the plan editor) is the rider's own hand on the
  // bottles, so it wins over a drink rhythm.
  const drinkAnchor = anchor?.type === "drink" && !inputs.bottleSetup && anchorCount > 0;
  const foodAnchor =
    anchor?.type === "food" && includeSolidFood && activeFoods.length > 0 && anchorCount > 0;

  // "One bottle" means the bottle this plan actually uses.
  const anchorBottleMl = bottles[0]?.mlCapacity ?? 500;

  // Anchored food is placed first — its carbs decide how strong the mix needs
  // to be. Items that don't fit the feed window are reported, not silently cut.
  const anchorFoodSlots =
    feedEndMin >= feedStartMin
      ? Math.max(1, Math.floor((feedEndMin - feedStartMin) / 15) + 1)
      : 0;
  const anchorFoodPlaced = foodAnchor ? Math.min(anchorCount, anchorFoodSlots) : 0;
  const anchoredFood = foodAnchor
    ? anchoredFoodTimes(anchorFoodPlaced, feedStartMin, feedEndMin).map((timeMin, i) => ({
        timeMin,
        food: activeFoods[i % activeFoods.length],
      }))
    : [];
  const anchoredFoodCarbs = anchoredFood.reduce((s, e) => s + e.food.carbsPerServing, 0);

  const { perHour: baseFluidPerHourMl, source: baseFluidSource } = resolveFluidPerHour(
    inputs.sweatRateMlPerHour,
    weather
  );
  // A bottle-per-hour rhythm is also a drinking rhythm: if it asks for more
  // fluid than the weather baseline, the rhythm sets the pace.
  const anchoredFluidMl = drinkAnchor ? anchorCount * anchorBottleMl : 0;
  const totalFluidMl = Math.max(Math.round(durationHours * baseFluidPerHourMl), anchoredFluidMl);
  const fluidPerHourMl =
    durationHours > 0 ? Math.round(totalFluidMl / durationHours) : baseFluidPerHourMl;
  const fluidSource: CalculatedPlan["fluidSource"] =
    anchoredFluidMl > Math.round(durationHours * baseFluidPerHourMl) ? "rhythm" : baseFluidSource;
  const sodiumTargetMg = Math.round((totalFluidMl / 1000) * SWEAT_SODIUM_MG_PER_L);

  // --- Bottle prep (what to mix tonight) ---
  // Two ways to build it: an explicit per-bottle setup (from the plan editor,
  // where each bottle already has a chosen drink + exact scoops), or the
  // wizard model (cycle the selected drinks across the bottles).
  const waterBottle = (id: string | undefined, i: number, mlCapacity: number): BottlePrep => ({
    bottleId: id ?? `b${i + 1}`,
    bottleIndex: i + 1,
    mlCapacity,
    drinkName: "Water",
    scoops: 0,
    waterMl: mlCapacity,
    carbsTotal: 0,
    sodiumMg: 0,
  });

  // A drink rhythm replaces the bottle list with "N bottles of mix", which may
  // be more than the rider carries — that's a refill-with-powder plan, and it's
  // flagged in the warnings below.
  const prepBottles: Bottle[] = drinkAnchor
    ? Array.from({ length: anchorCount }, (_, i) => ({
        id: `mix-${i + 1}`,
        mlCapacity: anchorBottleMl,
      }))
    : bottles;

  const plannedBottleMl = prepBottles.reduce((sum, b) => sum + b.mlCapacity, 0);
  // Bottles you don't finish don't deliver their carbs, so aim the mix at the
  // share of them this ride actually drinks.
  const plannedConsumedShare = plannedBottleMl > 0 ? Math.min(totalFluidMl / plannedBottleMl, 1) : 1;
  // With food setting the rhythm, the bottles are mixed to cover exactly the
  // carbs the food leaves behind.
  const drinkCarbTarget = foodAnchor
    ? Math.max(0, Math.round((totalCarbs - anchoredFoodCarbs) / Math.max(plannedConsumedShare, 0.1)))
    : 0;

  const bottlePrep: BottlePrep[] = inputs.bottleSetup
    ? inputs.bottleSetup.map((b, i) => {
        const product = b.drinkProductId
          ? inputs.drinks.find((d) => d.id === b.drinkProductId)
          : undefined;
        if (!product || b.scoops <= 0) return waterBottle(b.bottleId, i, b.mlCapacity);
        // scoops here are already scaled to the bottle (editor works per bottle)
        const servingRatio = b.scoops / product.scoopsRecommended;
        return {
          bottleId: b.bottleId ?? `b${i + 1}`,
          bottleIndex: i + 1,
          mlCapacity: b.mlCapacity,
          drinkProductId: product.id,
          drinkName: product.flavour ? `${product.name} (${product.flavour})` : product.name,
          scoops: b.scoops,
          waterMl: b.mlCapacity,
          carbsTotal: Math.round(servingRatio * product.carbsPerServing),
          sodiumMg: Math.round(servingRatio * (product.sodiumMgPerServing ?? 0)),
        };
      })
    : prepBottles.map((bottle, i) => {
        const drinkEntry = activeDrinks.length > 0 ? activeDrinks[i % activeDrinks.length] : null;
        if (!drinkEntry) return waterBottle(bottle.id, i, bottle.mlCapacity);

        const { product, sd } = drinkEntry;
        const scoops = sd.scoopsOverride ?? product.scoopsRecommended;
        const normalScoops = Math.round((bottle.mlCapacity / product.mlPerServing) * scoops);

        let scaledScoops = normalScoops;
        if (foodAnchor) {
          // Split the remaining carbs across the bottles by volume, then round
          // to whole scoops — capped so the mix stays drinkable.
          const carbsPerScoop = product.carbsPerServing / product.scoopsRecommended;
          const share = plannedBottleMl > 0 ? bottle.mlCapacity / plannedBottleMl : 1 / prepBottles.length;
          const maxScoops = Math.max(1, Math.round(normalScoops * MAX_CONCENTRATION_FACTOR));
          scaledScoops = Math.min(
            maxScoops,
            Math.max(0, Math.round((drinkCarbTarget * share) / Math.max(carbsPerScoop, 0.1)))
          );
        }
        if (scaledScoops <= 0) return waterBottle(bottle.id, i, bottle.mlCapacity);
        const servingRatio = scaledScoops / product.scoopsRecommended;

        return {
          bottleId: bottle.id,
          bottleIndex: i + 1,
          mlCapacity: bottle.mlCapacity,
          drinkProductId: product.id,
          drinkName: product.flavour ? `${product.name} (${product.flavour})` : product.name,
          scoops: scaledScoops,
          waterMl: bottle.mlCapacity,
          carbsTotal: Math.round(servingRatio * product.carbsPerServing),
          sodiumMg: Math.round(servingRatio * (product.sodiumMgPerServing ?? 0)),
        };
      });

  // --- Drink carbs the ride will actually deliver ---
  // Only the bottles you mix tonight carry carbs. On rides needing refills,
  // assume refills are WATER (that's what feed zones reliably offer) — solid
  // food must cover the remaining carbs.
  const initialBottleMl = bottlePrep.reduce((sum, b) => sum + b.mlCapacity, 0);
  const initialDrinkCarbs = bottlePrep.reduce((sum, b) => sum + b.carbsTotal, 0);
  const initialDrinkSodium = bottlePrep.reduce((sum, b) => sum + (b.sodiumMg ?? 0), 0);
  const bottleSets = initialBottleMl > 0 ? totalFluidMl / initialBottleMl : 1;
  // If bottles hold more than the ride needs, only the consumed share counts
  const consumedShare = Math.min(bottleSets, 1);
  const fullRideDrinkCarbs = Math.round(initialDrinkCarbs * consumedShare);

  // --- Solid food: fills only the remaining carb gap ---
  const foodCarbsGap = Math.max(0, totalCarbs - fullRideDrinkCarbs);

  // Place food sequentially. Each item's spacing depends on its OWN type — a
  // gel clears fast and can be followed sooner than a bar or real food. With a
  // food rhythm the count is already fixed, so those placements are used as-is.
  const foodEvents: { timeMin: number; food: FoodItem }[] = [];
  if (foodAnchor) {
    foodEvents.push(...anchoredFood);
  } else if (includeSolidFood && activeFoods.length > 0 && foodCarbsGap > 5 && feedEndMin >= feedStartMin) {
    let t = feedStartMin;
    let carbsPlaced = 0;
    let i = 0;
    while (t <= feedEndMin && carbsPlaced < foodCarbsGap && i < 40) {
      const food = activeFoods[i % activeFoods.length];
      foodEvents.push({ timeMin: Math.round(t), food });
      carbsPlaced += food.carbsPerServing;
      t += foodGap(food);
      i++;
    }
  }
  const foodSodiumDelivered = foodEvents.reduce((s, e) => s + (e.food.sodiumMg ?? 0), 0);

  // --- Build feeding schedule ---
  const firstDrinkMin = getFirstDrinkMin(durationHours);
  const schedule: ScheduleItem[] = [];
  let cumulativeCarbs = 0;
  let refillsNeeded = 0;

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

    // Merge a food event into a drink stop only when it's genuinely close
    // (≤5 min). Distant events get their own schedule row at the exact time.
    const FOOD_MERGE_TOLERANCE_MIN = 5;
    const foodByInterval = new Map<number, FoodItem>();
    const standaloneFoodEvents: { timeMin: number; food: FoodItem }[] = [];
    foodEvents.forEach(({ timeMin: foodTime, food }) => {
      if (drinkIntervals.length === 0) {
        standaloneFoodEvents.push({ timeMin: foodTime, food });
        return;
      }
      const nearest = drinkIntervals.reduce((best, t) =>
        Math.abs(t - foodTime) < Math.abs(best - foodTime) ? t : best
      );
      if (Math.abs(nearest - foodTime) <= FOOD_MERGE_TOLERANCE_MIN && !foodByInterval.has(nearest)) {
        foodByInterval.set(nearest, food);
      } else {
        standaloneFoodEvents.push({ timeMin: foodTime, food });
      }
    });

    // Sip-based fluid distribution (1 sip = 50ml). Crucially, pace to the
    // ride's fluid NEED (totalFluidMl), NOT to bottle capacity. When the need
    // exceeds what the bottles hold, the extra sips come from water refills and
    // an explicit "refill" checkpoint is dropped into the schedule.
    const SIP_ML = 50;
    const capSipsPerBottle = bottlePrep.map((b) => Math.max(0, Math.round(b.mlCapacity / SIP_ML)));
    const totalCapSips = capSipsPerBottle.reduce((a, b) => a + b, 0); // one full set of bottles
    const totalSips = Math.max(0, Math.round(totalFluidMl / SIP_ML));
    refillsNeeded = totalCapSips > 0 ? Math.max(0, Math.ceil(totalSips / totalCapSips) - 1) : 0;

    // Carbs delivered by the first `n` sips. Only the first set of bottles
    // carries the mix; every refill after that is water (0 carbs).
    const carbsForMixedSips = (n: number): number => {
      let carbs = 0;
      let remaining = Math.min(n, totalCapSips);
      for (let b = 0; b < bottlePrep.length && remaining > 0; b++) {
        const cap = capSipsPerBottle[b];
        if (cap <= 0) continue;
        const drawn = Math.min(cap, remaining);
        carbs += Math.round((drawn / cap) * bottlePrep[b].carbsTotal);
        remaining -= drawn;
      }
      return carbs;
    };

    // Which bottle a 0-based sip comes from, and whether it's water (either a
    // refilled set, or a bottle that was water-only to begin with).
    const sipSource = (i: number): { bottleIndex: number; isWater: boolean } => {
      if (totalCapSips <= 0) return { bottleIndex: 1, isWater: true };
      const setNo = Math.floor(i / totalCapSips);
      let pos = i % totalCapSips;
      for (let b = 0; b < bottlePrep.length; b++) {
        const cap = capSipsPerBottle[b];
        if (pos < cap) {
          const bottle = bottlePrep[b];
          return { bottleIndex: bottle.bottleIndex, isWater: setNo >= 1 || bottle.carbsTotal <= 0 };
        }
        pos -= cap;
      }
      const last = bottlePrep[bottlePrep.length - 1];
      return { bottleIndex: last?.bottleIndex ?? 1, isWater: true };
    };

    const bottleDisplayName = (bottleIndex: number, isWater: boolean): string => {
      if (isWater) return "Water";
      const b = bottlePrep.find((x) => x.bottleIndex === bottleIndex);
      if (!b || b.drinkName === "Water") return "Water";
      return b.drinkName.split(" (")[0];
    };

    let cumSips = 0;
    let carbsSoFar = 0;
    const intervalCum: { timeMin: number; cumEnd: number }[] = [];
    const rows: ScheduleItem[] = [];

    drinkIntervals.forEach((timeMin, idx) => {
      const km = Math.round((timeMin / 60) * avgSpeed);
      const food = foodByInterval.get(timeMin) ?? null;

      const targetCumSips =
        drinkIntervals.length > 0
          ? Math.round((totalSips * (idx + 1)) / drinkIntervals.length)
          : 0;
      const sips = Math.max(0, targetCumSips - cumSips);

      let drinkInfo: ScheduleItem["drink"] | undefined;
      if (sips > 0 && bottlePrep.length > 0 && totalCapSips > 0) {
        const startIdx = cumSips; // 0-based first sip of this interval
        const endIdx = cumSips + sips; // exclusive

        const carbsAfter = carbsForMixedSips(endIdx);
        const intervalCarbs = carbsAfter - carbsSoFar;
        carbsSoFar = carbsAfter;

        const start = sipSource(startIdx);
        const end = sipSource(endIdx - 1);
        // "finished" only within the first (mixed) set — moving to a new bottle
        const bottleFinished =
          Math.floor((endIdx - 1) / totalCapSips) === 0 && start.bottleIndex !== end.bottleIndex;

        drinkInfo = {
          bottleIndex: start.bottleIndex,
          drinkName: bottleDisplayName(start.bottleIndex, start.isWater),
          mlAmount: sips * SIP_ML,
          sips,
          carbs: intervalCarbs,
          ...(bottleFinished ? { bottleFinished: true } : {}),
        };
      }

      cumSips += sips;
      intervalCum.push({ timeMin, cumEnd: cumSips });

      rows.push({
        timeMin,
        km,
        drink: drinkInfo,
        food: food ? { name: food.name, carbs: food.carbsPerServing } : undefined,
        cumulativeCarbs: 0, // filled in below
      });
    });

    // Food events that didn't merge with a drink stop get their own row
    for (const { timeMin, food } of standaloneFoodEvents) {
      rows.push({
        timeMin,
        km: Math.round((timeMin / 60) * avgSpeed),
        food: { name: food.name, carbs: food.carbsPerServing },
        cumulativeCarbs: 0,
      });
    }

    // Refill checkpoints — one each time a full set of bottles is emptied.
    // Place each at the interval where cumulative drinking reaches that set's
    // capacity, and keep them on distinct (increasing) intervals.
    if (totalCapSips > 0 && refillsNeeded > 0) {
      let lastIdx = -1;
      for (let k = 1; k <= refillsNeeded; k++) {
        const threshold = k * totalCapSips;
        let idx = intervalCum.findIndex((c, i) => i > lastIdx && c.cumEnd >= threshold);
        if (idx === -1) idx = intervalCum.length - 1;
        if (idx < 0) break;
        lastIdx = idx;
        const timeMin = intervalCum[idx].timeMin;
        rows.push({
          timeMin,
          km: Math.round((timeMin / 60) * avgSpeed),
          cumulativeCarbs: 0,
          refill: true,
          note: `Refill bottles — assume water (~${(initialBottleMl / 1000).toFixed(1)}L per top-up)`,
        });
      }
    }

    rows.sort((a, b) => a.timeMin - b.timeMin || (a.refill ? 1 : 0) - (b.refill ? 1 : 0));
    for (const row of rows) {
      cumulativeCarbs += (row.drink?.carbs ?? 0) + (row.food?.carbs ?? 0);
      row.cumulativeCarbs = cumulativeCarbs;
      schedule.push(row);
    }
  }

  const drinkSodiumDelivered = Math.round(initialDrinkSodium * consumedShare);
  const sodiumDeliveredMg = drinkSodiumDelivered + foodSodiumDelivered;

  // --- Warnings ---
  const warnings: string[] = [];

  // --- Fueling rhythm: what it fixed, and where it strains ---
  let rhythmNote: string | undefined;
  const foodCarbsPlanned = foodEvents.reduce((s, e) => s + e.food.carbsPerServing, 0);
  if (drinkAnchor && anchor) {
    const gap = Math.max(0, totalCarbs - fullRideDrinkCarbs);
    rhythmNote =
      `Your rhythm — ${fmtRate(anchor.perHour)} bottle${anchor.perHour === 1 ? "" : "s"}/hr — sets this plan first: ` +
      `${anchorCount} × ${anchorBottleMl}ml of mix for ${fullRideDrinkCarbs}g of carbs. ` +
      (gap > 5
        ? `Solid food fills the remaining ${gap}g.`
        : `That already covers your ${totalCarbs}g target, so no food is scheduled.`);
    const baselineFluidMl = Math.round(durationHours * baseFluidPerHourMl);
    if (totalFluidMl > baselineFluidMl * 1.2) {
      warnings.push(
        `This rhythm paces you to ${fluidPerHourMl}ml/hr — well above the ${baseFluidPerHourMl}ml/hr these conditions call for. ` +
          (fluidPerHourMl >= 1000
            ? "Over ~1L/hr is more than most guts absorb, so much of it just sloshes. "
            : "") +
          `A smaller bottle or a lower rate keeps the carbs without the extra fluid.`
      );
    }
    if (anchorCount > bottles.length) {
      const refills = anchorCount - bottles.length;
      warnings.push(
        `Your rhythm asks for ${anchorCount} × ${anchorBottleMl}ml of mix but you're carrying ${bottles.length} bottle${bottles.length !== 1 ? "s" : ""}. ` +
          `Carry powder for ${refills} remix${refills !== 1 ? "es" : ""} en route — a plain water refill delivers no carbs.`
      );
    }
  } else if (foodAnchor && anchor) {
    const unit = activeFoods.length === 1 ? activeFoods[0].name : "solid item";
    rhythmNote =
      `Your rhythm — ${fmtRate(anchor.perHour)} × ${unit} per hour — sets this plan first: ` +
      `${anchorFoodPlaced} item${anchorFoodPlaced !== 1 ? "s" : ""} for ${foodCarbsPlanned}g of carbs. ` +
      (fullRideDrinkCarbs > 0
        ? `Your bottles are mixed to add the remaining ${fullRideDrinkCarbs}g.`
        : `That already covers your ${totalCarbs}g target, so your bottles are plain water.`);
    if (anchorFoodPlaced < anchorCount) {
      warnings.push(
        `Only ${anchorFoodPlaced} of the ${anchorCount} items your rhythm asks for fit between the ${feedStartMin}-min warm-up and the 20-min pre-finish cutoff. ` +
          `The rest stay in your pocket as backup.`
      );
    }
    if (anchorFoodPlaced > 1) {
      const actualGap = Math.round((feedEndMin - feedStartMin) / (anchorFoodPlaced - 1));
      const neededGap = Math.round(
        anchoredFood.reduce((s, e) => s + foodGap(e.food), 0) / anchoredFood.length
      );
      if (actualGap < neededGap) {
        warnings.push(
          `This rhythm puts food in every ~${actualGap} min, but what you've chosen typically needs ~${neededGap} min to clear the stomach. ` +
            `Fine with gels and chews, tight with bars or real food — halve the rate or switch to faster fuel if your gut complains.`
        );
      }
    }
    const drinkShortfall = Math.round(drinkCarbTarget * plannedConsumedShare) - fullRideDrinkCarbs;
    if (drinkShortfall > 10) {
      warnings.push(
        `Your food rhythm leaves ${Math.round(drinkCarbTarget * plannedConsumedShare)}g for the bottles, but even at ${MAX_CONCENTRATION_FACTOR}× normal strength they only carry ${fullRideDrinkCarbs}g. ` +
          `Add a bottle, a stronger drink mix, or accept the ${drinkShortfall}g shortfall.`
      );
    }
    if (foodCarbsPlanned > totalCarbs + 20) {
      warnings.push(
        `Your rhythm delivers ${foodCarbsPlanned}g of food carbs against a ${totalCarbs}g target — ${foodCarbsPlanned - totalCarbs}g more than this ride needs. ` +
          `Bottles are plain water to compensate; lower the rate or pick smaller items to bring it in line.`
      );
    }
  }

  if (carbsPerHour > 60 && activeDrinks.some((ad) => ad.product.carbRatio === "single")) {
    warnings.push(
      "You're targeting >60g carbs/hr with a single-source carb drink. Consider a drink with glucose + fructose (2:1 or 1:1 ratio) to avoid GI distress."
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
  if (refillsNeeded > 0) {
    warnings.push(
      `This ride needs ~${refillsNeeded} bottle refill${refillsNeeded > 1 ? "s" : ""}. The schedule paces you to your full ${totalFluidMl}ml fluid target and marks refill points — plan for a tap, feed zone or café. Refills are assumed to be water; carry extra powder if you want carbs in them.`
    );
  }
  // Electrolytes: flag when the ride is long/hot enough to matter and the plan
  // barely replaces any sodium.
  if ((durationHours >= 2 || (weather && weather.tempC > 25)) &&
      sodiumTargetMg >= 500 && sodiumDeliveredMg < sodiumTargetMg * 0.5) {
    warnings.push(
      `Low on sodium: this ride loses ~${sodiumTargetMg}mg via sweat but your plan replaces only ~${sodiumDeliveredMg}mg. Add an electrolyte mix or salty food — sodium helps you absorb both fluid and carbs, and wards off cramping on long/hot days.`
    );
  }
  const leftoverMl = initialBottleMl - totalFluidMl;
  if (leftoverMl >= 250 && durationHours >= 1) {
    warnings.push(
      `You're carrying ~${Math.round(leftoverMl / 50) * 50}ml more than this ride needs. The schedule paces you to ${fluidPerHourMl}ml/hr — the rest stays in your bottles as reserve.`
    );
  }
  if (fullRideDrinkCarbs < totalCarbs * 0.5 && !includeSolidFood) {
    warnings.push(
      "Your drinks alone may not cover your carb target. Consider enabling solid food or adding a carb-rich drink."
    );
  }

  // --- Pre-ride, recovery & caffeine notes ---
  let preRideNote: string | undefined;
  let recoveryNote: string | undefined;
  let caffeineNote: string | undefined;
  if (weightKg && durationHours >= 1.5) {
    const carbLoadG = Math.round(weightKg * 2);
    preRideNote = `Pre-ride (3–4hrs before): eat ~${carbLoadG}g carbs (2g per kg body weight). Think oats, rice, banana, toast.`;

    const recCarb = Math.round(weightKg * 1.1);
    const recProtein = Math.round(weightKg * 0.3);
    recoveryNote = `Within 60 min of finishing: ~${recCarb}g carbs + ~${recProtein}g protein (≈1.1g/kg carbs, 0.3g/kg protein) to refill glycogen and start repair. A recovery shake, rice + chicken, or milk + banana all do the job.`;
  }
  if (inputs.includeCaffeine) {
    if (weightKg) {
      const dose = Math.round(weightKg * 3);
      const coffee = dose < 120 ? "about one mug of coffee" : "one to two mugs of coffee";
      if (durationHours >= 3) {
        const second = Math.round(weightKg * 1.5);
        caffeineNote = `Caffeine: ~${dose}mg (3mg/kg, ${coffee}) 45–60 min before the start. On a ride this long a second ~${second}mg hit in the final third can lift a fading effort. Keep your day's total under ~6mg/kg.`;
      } else {
        caffeineNote = `Caffeine: ~${dose}mg (3mg/kg, ${coffee}) 45–60 min before you start. More isn't better — 3mg/kg is the evidence-based sweet spot.`;
      }
    } else {
      caffeineNote = `Caffeine: ~3mg per kg body weight, 45–60 min before the start (set your weight in Settings for an exact figure). More isn't better — 3mg/kg is the sweet spot.`;
    }
  }

  // What the schedule actually delivers: drink carbs consumed + food eaten.
  const actualCarbs = schedule.reduce(
    (sum, s) => sum + (s.drink?.carbs ?? 0) + (s.food?.carbs ?? 0),
    0
  );

  return {
    durationHours,
    totalCarbs: actualCarbs,
    totalFluidMl,
    bottlePrep,
    schedule,
    preRideNote,
    recoveryNote,
    caffeineNote,
    sodiumTargetMg,
    sodiumDeliveredMg,
    fluidPerHourMl,
    fluidSource,
    rhythmNote,
    warnings,
  };
}

export { getCarbsHourTip };

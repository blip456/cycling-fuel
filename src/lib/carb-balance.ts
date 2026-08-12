import { BOTTLE_SIZE_OPTIONS } from "./types";
import { formatBottleSize } from "./utils";
import type { BottleSetup } from "./fuel-calculator";
import type { Bottle, BottlePrep, CalculatedPlan, DrinkProduct, FuelPlan } from "./types";

// A bottle you carry is a bottle you finish. Every gram of powder you mix
// tonight therefore lands in you tomorrow, so a plan's carb total is simply the
// full contents of every bottle plus the food on the schedule — never a share
// pro-rated against what the ride "needs". That makes overshooting the target
// easy to do (two 90g bottles on a two-hour ride at 60g/hr is 180g against
// 120g), which is exactly what this module measures and offers a way out of.

export interface CarbBalance {
  /** Carbs the ride asks for: duration × carbs-per-hour. */
  targetCarbs: number;
  targetPerHour: number;
  /** Full contents of every mixed bottle — all of it gets drunk. */
  drinkCarbs: number;
  foodCarbs: number;
  plannedCarbs: number;
  /** planned − target. Positive means a surplus. */
  diffG: number;
  plannedPerHour: number;
  /** How far over target counts as "too many" rather than rounding noise. */
  toleranceG: number;
  overshoot: boolean;
}

export function carbBalance(input: {
  durationHours: number;
  carbsPerHour: number;
  drinkCarbs: number;
  foodCarbs: number;
}): CarbBalance {
  const { durationHours, carbsPerHour, drinkCarbs, foodCarbs } = input;
  const targetCarbs = Math.round(durationHours * carbsPerHour);
  const plannedCarbs = drinkCarbs + foodCarbs;
  const diffG = plannedCarbs - targetCarbs;
  // 15% of target, floored at 20g — below that a rounded scoop explains it.
  const toleranceG = Math.max(20, Math.round(targetCarbs * 0.15));
  return {
    targetCarbs,
    targetPerHour: carbsPerHour,
    drinkCarbs,
    foodCarbs,
    plannedCarbs,
    diffG,
    plannedPerHour: durationHours > 0 ? Math.round(plannedCarbs / durationHours) : plannedCarbs,
    toleranceG,
    overshoot: diffG > toleranceG,
  };
}

/** Carbs a bottle list will deliver — all of it, because you finish them. */
export function bottleCarbs(bottles: Pick<BottlePrep, "carbsTotal">[]): number {
  return bottles.reduce((sum, b) => sum + b.carbsTotal, 0);
}

export function scheduleFoodCarbs(schedule: CalculatedPlan["schedule"]): number {
  return schedule.reduce((sum, s) => sum + (s.food?.carbs ?? 0), 0);
}

/** The balance of a saved plan, read straight off its bottles and schedule. */
export function planCarbBalance(plan: FuelPlan, result: CalculatedPlan): CarbBalance {
  return carbBalance({
    durationHours: result.durationHours,
    carbsPerHour: plan.carbsPerHour,
    drinkCarbs: bottleCarbs(result.bottlePrep),
    foodCarbs: scheduleFoodCarbs(result.schedule),
  });
}

// --- Ways out of a surplus -------------------------------------------------

export interface OvershootAlternative {
  /** "drink-less" mixes weaker; "smaller-bottles" carries less fluid. */
  id: "drink-less" | "smaller-bottles";
  label: string;
  /** What changes, in numbers. */
  headline: string;
  detail: string;
  newDrinkCarbs: number;
  newTotalMl: number;
  /** Plan bottle list and per-bottle mix to recalculate from. */
  bottles: Bottle[];
  bottleSetup: BottleSetup[];
}

interface MixedBottle {
  prep: BottlePrep;
  product: DrinkProduct;
  carbsPerScoop: number;
}

function carbsFor(product: DrinkProduct, scoops: number): number {
  return Math.round((scoops / product.scoopsRecommended) * product.carbsPerServing);
}

function bottleList(prep: BottlePrep[]): Bottle[] {
  return prep.map((b) => ({ id: b.bottleId, mlCapacity: b.mlCapacity }));
}

function setupFrom(
  prep: BottlePrep[],
  override: Map<string, { mlCapacity: number; scoops: number }>
): BottleSetup[] {
  return prep.map((b) => {
    const o = override.get(b.bottleId);
    return {
      bottleId: b.bottleId,
      mlCapacity: o?.mlCapacity ?? b.mlCapacity,
      drinkProductId: b.drinkProductId ?? null,
      scoops: o?.scoops ?? b.scoops,
    };
  });
}

function fluidNote(newTotalMl: number, needMl: number): string {
  if (newTotalMl >= needMl - 100) return "";
  return (
    ` That leaves ${(newTotalMl / 1000).toFixed(1)}L against the ${(needMl / 1000).toFixed(1)}L this ride needs, ` +
    `so plan one water refill — a plain top-up adds no carbs.`
  );
}

/**
 * Two concrete ways to bring a carb surplus back to target: mix less powder into
 * the same bottles, or carry smaller bottles at the same strength. Each comes
 * with the bottle list and per-bottle mix to recalculate the plan from.
 * Returns only the ones that actually change something.
 */
export function overshootAlternatives(
  plan: FuelPlan,
  result: CalculatedPlan,
  drinks: DrinkProduct[],
  balance: CarbBalance
): OvershootAlternative[] {
  const mixed: MixedBottle[] = result.bottlePrep
    .filter((b) => b.carbsTotal > 0 && b.scoops > 0 && b.drinkProductId)
    .map((prep) => {
      const product = drinks.find((d) => d.id === prep.drinkProductId);
      return product
        ? { prep, product, carbsPerScoop: product.carbsPerServing / product.scoopsRecommended }
        : null;
    })
    .filter((m): m is MixedBottle => m !== null);

  if (mixed.length === 0 || balance.drinkCarbs <= 0) return [];

  // Carbs the bottles should carry. With a food rhythm the food is fixed first,
  // so the bottles only need to cover what it leaves; otherwise aim at the full
  // target and let a recalculation fill any gap with food.
  const drinkTarget =
    plan.fuelAnchor?.type === "food"
      ? Math.max(0, balance.targetCarbs - balance.foodCarbs)
      : balance.targetCarbs;
  const factor = Math.max(0, Math.min(1, drinkTarget / balance.drinkCarbs));
  const currentTotalMl = result.bottlePrep.reduce((sum, b) => sum + b.mlCapacity, 0);
  const needMl = result.totalFluidMl;
  const alternatives: OvershootAlternative[] = [];

  // --- Mix less powder: same bottles, same fluid, weaker mix ---------------
  {
    const scoops = mixed.map((m) => Math.max(0, Math.floor(m.prep.scoops * factor)));
    const total = () => mixed.reduce((sum, m, i) => sum + carbsFor(m.product, scoops[i]), 0);
    // Hand scoops back one at a time while they still fit under the target, so
    // we land as close under it as whole scoops allow.
    let added = true;
    while (added) {
      added = false;
      for (let i = 0; i < mixed.length; i++) {
        if (scoops[i] >= mixed[i].prep.scoops) continue;
        if (total() + Math.round(mixed[i].carbsPerScoop) <= drinkTarget) {
          scoops[i] += 1;
          added = true;
        }
      }
    }
    const newDrinkCarbs = total();
    if (scoops.some((s, i) => s !== mixed[i].prep.scoops)) {
      const override = new Map(
        mixed.map((m, i) => [m.prep.bottleId, { mlCapacity: m.prep.mlCapacity, scoops: scoops[i] }])
      );
      const emptied = scoops.filter((s) => s === 0).length;
      const changes = mixed
        .map((m, i) => `B${m.prep.bottleIndex} ${m.prep.scoops} → ${scoops[i]}`)
        .join(" · ");
      const parts = [`Same bottles, same ${(currentTotalMl / 1000).toFixed(1)}L to drink — just less powder in them.`];
      if (emptied === mixed.length) {
        // One scoop already outweighs the target: whole scoops can't get closer.
        parts.push(
          `A single scoop already carries more than this ride asks for, so the nearest whole-scoop mix is plain water.`
        );
      } else if (emptied > 0) {
        parts.push(
          `${emptied} bottle${emptied !== 1 ? "s" : ""} become${emptied === 1 ? "s" : ""} plain water.`
        );
      }
      parts.push(
        plan.includeSolidFood
          ? "Solid food is re-added to fill whatever gap is left."
          : `Solid food is off for this plan, so ${newDrinkCarbs}g is what you'd take in.`
      );
      alternatives.push({
        id: "drink-less",
        label: "Drink less mix",
        headline: `${balance.drinkCarbs}g → ${newDrinkCarbs}g of drink carbs (${changes} scoops)`,
        detail: parts.join(" "),
        newDrinkCarbs,
        newTotalMl: currentTotalMl,
        bottles: bottleList(result.bottlePrep),
        bottleSetup: setupFrom(result.bottlePrep, override),
      });
    }
  }

  // --- Bring less fluid: smaller bottles at the same strength --------------
  {
    const smallest = Math.min(...BOTTLE_SIZE_OPTIONS);
    const override = new Map<string, { mlCapacity: number; scoops: number }>();
    let newDrinkCarbs = 0;
    let shrank = false;
    for (const m of mixed) {
      const idealMl = m.prep.mlCapacity * factor;
      const fits = BOTTLE_SIZE_OPTIONS.filter((ml) => ml <= m.prep.mlCapacity && ml <= idealMl);
      const newMl = fits.length > 0 ? Math.max(...fits) : smallest;
      // Same concentration in a smaller bottle — round down so a rounded scoop
      // can't hand the surplus back.
      const newScoops = Math.max(
        1,
        Math.floor((m.prep.scoops * newMl) / Math.max(1, m.prep.mlCapacity))
      );
      if (newMl < m.prep.mlCapacity) shrank = true;
      override.set(m.prep.bottleId, { mlCapacity: newMl, scoops: newScoops });
      newDrinkCarbs += carbsFor(m.product, newScoops);
    }
    const newTotalMl = result.bottlePrep.reduce(
      (sum, b) => sum + (override.get(b.bottleId)?.mlCapacity ?? b.mlCapacity),
      0
    );
    if (shrank && newTotalMl < currentTotalMl) {
      const sizes = mixed
        .map((m) => {
          const o = override.get(m.prep.bottleId)!;
          return `B${m.prep.bottleIndex} ${formatBottleSize(m.prep.mlCapacity)} → ${formatBottleSize(o.mlCapacity)}`;
        })
        .join(" · ");
      alternatives.push({
        id: "smaller-bottles",
        label: "Bring fewer millilitres",
        headline: `${(currentTotalMl / 1000).toFixed(1)}L → ${(newTotalMl / 1000).toFixed(1)}L carried, ${balance.drinkCarbs}g → ${newDrinkCarbs}g of drink carbs (${sizes})`,
        detail:
          `Your mix stays exactly as strong — there's simply less of it to finish.` +
          fluidNote(newTotalMl, needMl),
        newDrinkCarbs,
        newTotalMl,
        bottles: result.bottlePrep.map((b) => ({
          id: b.bottleId,
          mlCapacity: override.get(b.bottleId)?.mlCapacity ?? b.mlCapacity,
        })),
        bottleSetup: setupFrom(result.bottlePrep, override),
      });
    }
  }

  return alternatives;
}

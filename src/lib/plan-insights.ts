import { formatDuration } from "./utils";
import { CARB_RATE_OPTIONS } from "./types";
import type { FuelPlan, CalculatedPlan, CarbRate, RideIntensity } from "./types";

export type InsightLevel = "error" | "warning" | "suggestion";

export interface PlanInsight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
}

export const INTENSITY_LABELS: Record<RideIntensity, string> = {
  easy: "easy",
  steady: "steady",
  hard: "hard",
};

// Science baseline scaled by both duration AND intensity. Leisure riders burn
// far fewer carbs/hr than racers; 90–120g/hr is only warranted at high effort.
// 120g/hr is never auto-recommended — it requires deliberate gut training.
export function recommendedCarbsPerHour(
  durationH: number,
  intensity: RideIntensity = "steady"
): CarbRate {
  switch (intensity) {
    case "easy":
      if (durationH < 1.5) return 30;
      if (durationH < 3) return 45;
      return 60;
    case "steady":
      if (durationH < 1) return 30;
      if (durationH < 2) return 45;
      if (durationH < 3) return 60;
      return 90;
    case "hard":
      if (durationH < 1) return 45;
      if (durationH < 2) return 60;
      return 90;
  }
}

// Feed window helpers (mirrors fuel-calculator logic)
export function calcMaxFoodItems(durationH: number): number {
  const durationMin = durationH * 60;
  const feedStartMin = Math.max(30, Math.min(45, Math.round(durationMin * 0.15)));
  const feedWindowMin = durationMin - feedStartMin - 20;
  if (feedWindowMin < 0) return 0;
  // The slot at the window start counts too, hence +1
  return Math.floor(feedWindowMin / 50) + 1;
}

export function generateInsights(
  plan: FuelPlan,
  result: CalculatedPlan
): PlanInsight[] {
  const insights: PlanInsight[] = [];
  const durationH = result.durationHours;
  const intensity = plan.intensity ?? "steady";

  // Carbs the schedule actually delivers (drinks consumed + food eaten)
  const actualCarbs = result.schedule.reduce(
    (s, i) => s + (i.drink?.carbs ?? 0) + (i.food?.carbs ?? 0),
    0
  );
  const targetCarbs = Math.round(durationH * plan.carbsPerHour);

  // ── 1. Carb target below science recommendation ──────────────────────
  const rec = recommendedCarbsPerHour(durationH, intensity);
  const stepDiff =
    CARB_RATE_OPTIONS.indexOf(plan.carbsPerHour) - CARB_RATE_OPTIONS.indexOf(rec);
  if (stepDiff < 0) {
    insights.push({
      id: "low-carbs",
      level: "suggestion",
      title: `${rec}g/hr recommended for a ${INTENSITY_LABELS[intensity]} ${formatDuration(durationH)} ride`,
      detail:
        `You've set ${plan.carbsPerHour}g/hr. For this duration and effort, ${rec}g/hr keeps glycogen topped up so energy doesn't fade near the finish.`,
    });
  }

  // ── 1b. Carb target well above what this ride needs ─────────────────
  if (stepDiff >= 2) {
    insights.push({
      id: "high-carbs",
      level: "suggestion",
      title: `${plan.carbsPerHour}g/hr is likely more than this ride needs`,
      detail:
        `For a ${INTENSITY_LABELS[intensity]} ${formatDuration(durationH)} ride, ~${rec}g/hr is plenty. ` +
        `Extra carbs cost money, add gut load, and won't make you faster at this effort.`,
    });
  }

  // ── 2. Significant carb shortfall (only when user has carb sources) ──
  const bottleCarbs = result.bottlePrep.reduce((s, b) => s + b.carbsTotal, 0);
  const carbShortfall = targetCarbs - actualCarbs;
  if (durationH >= 1 &&
      (bottleCarbs > 0 || plan.selectedFoods.length > 0) &&
      carbShortfall > Math.max(15, targetCarbs * 0.15)) {
    insights.push({
      id: "carb-shortfall",
      level: "warning",
      title: `${carbShortfall}g carb shortfall vs target`,
      detail:
        `Plan delivers ${actualCarbs}g but your ${plan.carbsPerHour}g/hr target over ${formatDuration(durationH)} calls for ${targetCarbs}g. ` +
        `Increase scoops, add another drink product, or add a solid food item.`,
    });
  }

  // ── 3. No solid food on a long ride ─────────────────────────────────
  if (durationH >= 2.5 && !plan.includeSolidFood) {
    insights.push({
      id: "no-food-long",
      level: "suggestion",
      title: `Solid food helps on rides ≥ 2.5 h`,
      detail:
        `Liquid carbs alone cause flavour fatigue and psychological flatness on long efforts. ` +
        `Even one item (bar, banana) every 50 min keeps motivation and gut comfort higher.`,
    });
  }

  // ── 4. More food selected than the schedule includes ─────────────────
  if (plan.includeSolidFood) {
    const scheduledFoodCount = result.schedule.filter((s) => s.food).length;
    const selectedFoodCount = plan.selectedFoods.length;
    const dropped = selectedFoodCount - scheduledFoodCount;
    if (dropped > 0) {
      const maxItems = calcMaxFoodItems(durationH);
      if (scheduledFoodCount >= maxItems) {
        // Genuinely limited by the feed window
        insights.push({
          id: "food-dropped",
          level: "warning",
          title: `${dropped} food item${dropped > 1 ? "s" : ""} don't fit the feed window`,
          detail:
            `The 50-min spacing rule and 20-min pre-finish cutoff only allow ${maxItems} ` +
            `item${maxItems !== 1 ? "s" : ""} on this ride. The rest of your selection stays in your pocket as backup.`,
        });
      } else {
        // Window has room — drinks already cover the target
        insights.push({
          id: "food-not-needed",
          level: "suggestion",
          title: `Only ${scheduledFoodCount} of ${selectedFoodCount} food item${selectedFoodCount !== 1 ? "s" : ""} scheduled`,
          detail:
            `Your drinks already deliver most of the ${plan.carbsPerHour}g/hr target, so the remaining ` +
            `item${dropped !== 1 ? "s" : ""} ${dropped !== 1 ? "aren't" : "isn't"} needed. ` +
            `Want more solid food? Lower the scoops per bottle and the schedule will lean on food instead.`,
        });
      }
    }
  }

  // Sort: error → warning → suggestion
  const order: Record<InsightLevel, number> = { error: 0, warning: 1, suggestion: 2 };
  return insights.sort((a, b) => order[a.level] - order[b.level]);
}

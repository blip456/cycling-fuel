import { formatDuration } from "./utils";
import type { FuelPlan, CalculatedPlan } from "./types";

export type InsightLevel = "error" | "warning" | "suggestion";

export interface PlanInsight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
}

export function recommendedCarbsPerHour(durationH: number): 45 | 60 | 90 | 120 {
  if (durationH < 1) return 45;
  if (durationH < 2) return 60;
  if (durationH < 4) return 90;
  return 120;
}

// Feed window helpers (mirrors fuel-calculator logic)
export function calcMaxFoodItems(durationH: number): number {
  const durationMin = durationH * 60;
  const feedStartMin = Math.max(30, Math.min(45, Math.round(durationMin * 0.15)));
  const feedWindowMin = Math.max(0, durationMin - feedStartMin - 20);
  return Math.floor(feedWindowMin / 50);
}

export function generateInsights(
  plan: FuelPlan,
  result: CalculatedPlan
): PlanInsight[] {
  const insights: PlanInsight[] = [];
  const durationH = result.durationHours;

  const actualCarbs =
    result.bottlePrep.reduce((s, b) => s + b.carbsTotal, 0) +
    result.schedule.reduce((s, i) => s + (i.food?.carbs ?? 0), 0);
  const targetCarbs = Math.round(durationH * plan.carbsPerHour);

  // ── 1. Carb target below science recommendation ──────────────────────
  const minRec = recommendedCarbsPerHour(durationH);
  if (plan.carbsPerHour < minRec) {
    insights.push({
      id: "low-carbs",
      level: "suggestion",
      title: `${minRec}g/hr recommended for ${formatDuration(durationH)}`,
      detail:
        `You've set ${plan.carbsPerHour}g/hr. Research consistently shows ${minRec}g/hr as the minimum for rides this long — below this, glycogen runs out before the finish and power drops sharply.`,
    });
  }

  // ── 2. Significant carb shortfall (only when user has carb sources) ──
  const bottleCarbs = result.bottlePrep.reduce((s, b) => s + b.carbsTotal, 0);
  const carbShortfall = targetCarbs - actualCarbs;
  if ((bottleCarbs > 0 || plan.selectedFoods.length > 0) &&
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

  // ── 4. More food selected than schedule can fit ──────────────────────
  if (plan.includeSolidFood) {
    const scheduledFoodCount = result.schedule.filter((s) => s.food).length;
    const selectedFoodCount = plan.selectedFoods.length;
    const dropped = selectedFoodCount - scheduledFoodCount;
    if (dropped > 0) {
      insights.push({
        id: "food-dropped",
        level: "warning",
        title: `${dropped} food item${dropped > 1 ? "s" : ""} dropped from schedule`,
        detail:
          `The 50-min spacing rule and 20-min pre-finish cutoff only allow ${scheduledFoodCount} ` +
          `item${scheduledFoodCount !== 1 ? "s" : ""} in this ride's feed window. ` +
          `${dropped > 1 ? `${dropped} items were` : "1 item was"} silently dropped.`,
      });
    }
  }

  // Sort: error → warning → suggestion
  const order: Record<InsightLevel, number> = { error: 0, warning: 1, suggestion: 2 };
  return insights.sort((a, b) => order[a.level] - order[b.level]);
}

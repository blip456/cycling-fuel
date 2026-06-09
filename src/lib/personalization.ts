import { CARB_RATE_OPTIONS } from "./types";
import type { CarbRate, FuelPlan, RideIntensity } from "./types";
import { recommendedCarbsPerHour } from "./plan-insights";

const MAX_FEEDBACK_LOOKBACK = 5;

function stepRate(rate: CarbRate, delta: number): CarbRate {
  const i = CARB_RATE_OPTIONS.indexOf(rate);
  const next = Math.min(CARB_RATE_OPTIONS.length - 1, Math.max(0, i + delta));
  return CARB_RATE_OPTIONS[next];
}

function recentFeedbackPlans(plans: FuelPlan[], intensity: RideIntensity): FuelPlan[] {
  const withFeedback = plans
    .filter((p) => p.feedback)
    .sort((a, b) => new Date(b.rideDate).getTime() - new Date(a.rideDate).getTime());
  // Prefer rides at the same intensity once there's enough signal there
  const sameIntensity = withFeedback.filter((p) => (p.intensity ?? "steady") === intensity);
  const pool = sameIntensity.length >= 2 ? sameIntensity : withFeedback;
  return pool.slice(0, MAX_FEEDBACK_LOOKBACK);
}

export interface CarbSuggestion {
  suggested: CarbRate;
  base: CarbRate;
  reason: string;
  feedbackCount: number;
}

// Personal carb target: science baseline adjusted by what the rider reported
// after past rides. Conservative by design — moves at most one step from the
// baseline, and gut trouble caps the suggestion at 60g/hr.
export function personalizedCarbTarget(
  durationH: number,
  intensity: RideIntensity,
  plans: FuelPlan[]
): CarbSuggestion {
  const base = recommendedCarbsPerHour(durationH, intensity);
  const relevant = recentFeedbackPlans(plans, intensity);

  if (relevant.length === 0) {
    return {
      suggested: base,
      base,
      reason: "Science baseline for this duration and effort.",
      feedbackCount: 0,
    };
  }

  const tooMuch = relevant.filter((p) => p.feedback!.carbFeel === "too_much").length;
  const tooLittle = relevant.filter((p) => p.feedback!.carbFeel === "too_little").length;
  const gutTrouble = relevant.filter((p) => p.feedback!.gutFeel === "bad").length;

  let suggested = base;
  let reason = "Science baseline for this duration and effort.";

  if (tooMuch >= 2 && tooLittle === 0) {
    suggested = stepRate(base, -1);
    reason = `You marked carbs "too much" on ${tooMuch} of your last ${relevant.length} rides — stepping the baseline down.`;
  } else if (tooLittle >= 2 && tooMuch === 0) {
    suggested = stepRate(base, 1);
    reason = `You marked carbs "too little" on ${tooLittle} of your last ${relevant.length} rides — stepping the baseline up.`;
  } else {
    const lastRight = relevant.find((p) => p.feedback!.carbFeel === "right");
    if (lastRight) {
      const diff =
        CARB_RATE_OPTIONS.indexOf(lastRight.carbsPerHour) - CARB_RATE_OPTIONS.indexOf(base);
      if (diff !== 0 && Math.abs(diff) === 1) {
        suggested = lastRight.carbsPerHour;
        reason = `${lastRight.carbsPerHour}g/hr felt right on a recent similar ride.`;
      }
    }
  }

  if (gutTrouble >= 2 && suggested > 60) {
    suggested = 60;
    reason = `Capped at 60g/hr — you reported gut trouble on ${gutTrouble} recent rides. Build intake back up gradually.`;
  }

  return { suggested, base, reason, feedbackCount: relevant.length };
}

// Hydration hint derived from fluid feedback on recent rides.
export function fluidFeedbackHint(plans: FuelPlan[], intensity: RideIntensity): string | null {
  const relevant = recentFeedbackPlans(plans, intensity).filter((p) => p.feedback!.fluidFeel);
  if (relevant.length < 2) return null;
  const tooLittle = relevant.filter((p) => p.feedback!.fluidFeel === "too_little").length;
  const tooMuch = relevant.filter((p) => p.feedback!.fluidFeel === "too_much").length;
  if (tooLittle >= 2 && tooMuch === 0) {
    return `On ${tooLittle} recent rides you finished thirsty — consider an extra or larger bottle.`;
  }
  if (tooMuch >= 2 && tooLittle === 0) {
    return `On ${tooMuch} recent rides you came home with fluid to spare — a smaller setup may do.`;
  }
  return null;
}

export interface FeedbackSummary {
  count: number;
  carbTrend: "lower" | "higher" | "settled" | null;
  gutTrouble: boolean;
}

// Compact summary for the settings page.
export function summarizeFeedback(plans: FuelPlan[]): FeedbackSummary {
  const withFeedback = plans.filter((p) => p.feedback);
  if (withFeedback.length === 0) return { count: 0, carbTrend: null, gutTrouble: false };
  const recent = withFeedback
    .sort((a, b) => new Date(b.rideDate).getTime() - new Date(a.rideDate).getTime())
    .slice(0, MAX_FEEDBACK_LOOKBACK);
  const tooMuch = recent.filter((p) => p.feedback!.carbFeel === "too_much").length;
  const tooLittle = recent.filter((p) => p.feedback!.carbFeel === "too_little").length;
  let carbTrend: FeedbackSummary["carbTrend"] = "settled";
  if (tooMuch >= 2 && tooLittle === 0) carbTrend = "lower";
  else if (tooLittle >= 2 && tooMuch === 0) carbTrend = "higher";
  const gutTrouble = recent.filter((p) => p.feedback!.gutFeel === "bad").length >= 2;
  return { count: withFeedback.length, carbTrend, gutTrouble };
}

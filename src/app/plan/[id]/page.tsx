"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Sun, Cloud, CloudRain, CloudLightning,
  Snowflake, Wind, Droplets, Flame, AlertTriangle, Bike, Coffee,
  Pencil, X, Plus, Check, Trash2, Minus, Info, Download, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { formatDuration, formatTime, generateId, formatBottleSize } from "@/lib/utils";
import { calculateFuelPlan } from "@/lib/fuel-calculator";
import { generateInsights, type PlanInsight } from "@/lib/plan-insights";
import { generateGarminTCX } from "@/lib/export-garmin";
import { CARB_RATE_OPTIONS, BOTTLE_SIZE_OPTIONS } from "@/lib/types";
import type {
  FuelPlan, ScheduleItem, BottlePrep, WeatherData, Bottle,
  CarbRate, RideFeedback, FeedbackFeel, GutFeel,
} from "@/lib/types";

function WeatherIcon({ icon, className }: { icon: WeatherData["icon"]; className?: string }) {
  const cls = className ?? "h-5 w-5";
  switch (icon) {
    case "sun": return <Sun className={cls} />;
    case "rain": return <CloudRain className={cls} />;
    case "storm": return <CloudLightning className={cls} />;
    case "snow": return <Snowflake className={cls} />;
    case "fog": return <Wind className={cls} />;
    default: return <Cloud className={cls} />;
  }
}

function InsightCard({ insight }: { insight: PlanInsight }) {
  const styles = {
    error:      { wrap: "bg-red-50 border-red-200",    icon: "text-red-500",    title: "text-red-900",    body: "text-red-700" },
    warning:    { wrap: "bg-amber-50 border-amber-200", icon: "text-amber-500",  title: "text-amber-900",  body: "text-amber-700" },
    suggestion: { wrap: "bg-sky-50 border-sky-200",    icon: "text-sky-500",    title: "text-sky-900",    body: "text-sky-700" },
  }[insight.level];
  const Icon = insight.level === "error" || insight.level === "warning" ? AlertTriangle : Info;
  return (
    <div className={`rounded-2xl border px-4 py-3.5 flex gap-3 ${styles.wrap}`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${styles.icon}`} />
      <div>
        <p className={`text-sm font-semibold leading-snug ${styles.title}`}>{insight.title}</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${styles.body}`}>{insight.detail}</p>
      </div>
    </div>
  );
}

const CARB_FEEL_LABELS: { value: FeedbackFeel; label: string }[] = [
  { value: "too_little", label: "Too little" },
  { value: "right", label: "Just right" },
  { value: "too_much", label: "Too much" },
];
const GUT_FEEL_LABELS: { value: GutFeel; label: string }[] = [
  { value: "fine", label: "Fine" },
  { value: "uncomfortable", label: "A bit off" },
  { value: "bad", label: "Bad" },
];

function feelLabel(value: string | undefined, options: { value: string; label: string }[]) {
  return options.find((o) => o.value === value)?.label;
}

function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all duration-150 ${
              value === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:border-primary/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackSection({
  plan,
  onSave,
}: {
  plan: FuelPlan;
  onSave: (fb: RideFeedback) => void;
}) {
  const existing = plan.feedback;
  const [editing, setEditing] = useState(!existing);
  const [carbFeel, setCarbFeel] = useState<FeedbackFeel | null>(existing?.carbFeel ?? null);
  const [fluidFeel, setFluidFeel] = useState<FeedbackFeel | null>(existing?.fluidFeel ?? null);
  const [gutFeel, setGutFeel] = useState<GutFeel | null>(existing?.gutFeel ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  function handleSave() {
    if (!carbFeel) return;
    onSave({
      recordedAt: new Date().toISOString(),
      carbFeel,
      fluidFeel: fluidFeel ?? undefined,
      gutFeel: gutFeel ?? undefined,
      notes: notes.trim() || undefined,
    });
    setEditing(false);
  }

  return (
    <section>
      <h2 className="eyebrow text-muted-foreground mb-3">
        📝 How did it go?
      </h2>

      {!editing && existing ? (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-sage-light text-primary text-xs font-medium px-2.5 py-1">
                Carbs: {feelLabel(existing.carbFeel, CARB_FEEL_LABELS)}
              </span>
              {existing.fluidFeel && (
                <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-700 text-xs font-medium px-2.5 py-1">
                  Fluid: {feelLabel(existing.fluidFeel, CARB_FEEL_LABELS)}
                </span>
              )}
              {existing.gutFeel && (
                <span className="inline-flex items-center rounded-full bg-peach-light text-accent text-xs font-medium px-2.5 py-1">
                  Gut: {feelLabel(existing.gutFeel, GUT_FEEL_LABELS)}
                </span>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="p-2 -m-1 rounded-xl hover:bg-muted transition-colors text-muted-foreground shrink-0"
              title="Edit feedback"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          {existing.notes && (
            <p className="text-sm text-muted-foreground mt-2.5">{existing.notes}</p>
          )}
          <p className="text-xs text-muted-foreground/70 mt-2.5">
            This feedback tunes the carb suggestions for your next rides.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground -mb-1">
            Log how the fueling felt — future plans will adapt to what works for you.
          </p>
          <SegmentedRow
            label={`Carbs (${plan.carbsPerHour}g/hr planned)`}
            options={CARB_FEEL_LABELS}
            value={carbFeel}
            onChange={setCarbFeel}
          />
          <SegmentedRow
            label="Fluid"
            options={CARB_FEEL_LABELS}
            value={fluidFeel}
            onChange={setFluidFeel}
          />
          <SegmentedRow
            label="Stomach / gut"
            options={GUT_FEEL_LABELS}
            value={gutFeel}
            onChange={setGutFeel}
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. banana at km 40 worked great, drink too sweet…"
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!carbFeel}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" />
            Save Feedback
          </button>
        </div>
      )}
    </section>
  );
}

function getWeatherLabel(tempC: number) {
  if (tempC < 10) return { label: "Cold", color: "text-blue-500" };
  if (tempC < 18) return { label: "Cool", color: "text-sky-500" };
  if (tempC < 26) return { label: "Moderate", color: "text-green-600" };
  return { label: "Hot — stay hydrated!", color: "text-orange-500" };
}

type EditBottle = {
  bottleId: string;
  bottleIndex: number;
  mlCapacity: number;
  drinkProductId: string | null;
  scoops: number;
};

type EditItem = {
  timeMin: number;
  km: number;
  drink?: ScheduleItem["drink"];
  food?: { name: string; carbs: number } | null;
  note?: string;
  refill?: boolean;
};

export default function PlanResultPage() {
  const params = useParams();
  const router = useRouter();
  const { getPlan, savePlan, deletePlan, foods, drinks, profile } = useStore();
  const [plan, setPlan] = useState<FuelPlan | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sipHintDismissed, setSipHintDismissed] = useState(() => {
    try { return localStorage.getItem("sipHintDismissed") === "1"; } catch { return false; }
  });
  const [editBottles, setEditBottles] = useState<EditBottle[]>([]);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null);
  const [editCarbsPerHour, setEditCarbsPerHour] = useState<CarbRate>(60);
  const [editPlanBottles, setEditPlanBottles] = useState<Bottle[]>([]);

  useEffect(() => {
    const found = getPlan(params.id as string);
    if (found) setPlan(found);
    else router.replace("/");
  }, [params.id, getPlan, router]);

  // Derive live bottle prep (carbs recalculate when drink/scoops change)
  const liveBottles = useMemo((): BottlePrep[] => {
    return editBottles.map((eb) => {
      const product = drinks.find((d) => d.id === eb.drinkProductId);
      if (!product) {
        return {
          bottleId: eb.bottleId,
          bottleIndex: eb.bottleIndex,
          mlCapacity: eb.mlCapacity,
          drinkName: "Water",
          scoops: 0,
          waterMl: eb.mlCapacity,
          carbsTotal: 0,
        };
      }
      const carbsTotal = Math.round(
        (eb.scoops / product.scoopsRecommended) * product.carbsPerServing
      );
      return {
        bottleId: eb.bottleId,
        bottleIndex: eb.bottleIndex,
        mlCapacity: eb.mlCapacity,
        drinkProductId: product.id,
        drinkName: product.flavour ? `${product.name} (${product.flavour})` : product.name,
        scoops: eb.scoops,
        waterMl: eb.mlCapacity,
        carbsTotal,
      };
    });
  }, [editBottles, drinks]);

  // Live schedule: recompute drink carbs from the edited bottles. Only the
  // first `mlCapacity` of each bottle carries the mix — anything drunk beyond
  // that is a water refill (0 carbs). Without this cap, refill rides (fluid
  // need > bottle capacity) credit the refills and wildly inflate drink carbs.
  const liveSchedule = useMemo(() => {
    let cum = 0;
    const drawnMl: Record<number, number> = {};
    const creditedCarbs: Record<number, number> = {};
    return editItems.map((item) => {
      let drinkCarbs = 0;
      let updatedDrink = item.drink;
      if (item.drink) {
        const bottle = liveBottles.find((b) => b.bottleIndex === item.drink!.bottleIndex);
        if (bottle) {
          const bi = item.drink.bottleIndex;
          const cap = bottle.mlCapacity;
          const before = drawnMl[bi] ?? 0;
          const after = before + item.drink.mlAmount;
          drawnMl[bi] = after;
          if (bottle.carbsTotal > 0 && cap > 0) {
            // Carbs delivered scale with the share of the bottle's OWN capacity
            // consumed, capped at 100% — telescoped for drift-free totals.
            const carbsAfter = Math.round((Math.min(after, cap) / cap) * bottle.carbsTotal);
            drinkCarbs = Math.max(0, carbsAfter - (creditedCarbs[bi] ?? 0));
            creditedCarbs[bi] = carbsAfter;
          }
          updatedDrink = {
            ...item.drink,
            carbs: drinkCarbs,
            drinkName: bottle.drinkName === "Water" ? "Water" : bottle.drinkName.split(" (")[0],
          };
        }
      }
      const foodCarbs = item.food?.carbs ?? 0;
      cum += drinkCarbs + foodCarbs;
      return { ...item, drink: updatedDrink, cumulativeCarbs: cum, food: item.food ?? undefined };
    });
  }, [editItems, liveBottles]);

  // What the schedule delivers: drink carbs consumed + food eaten
  const liveTotalCarbs = useMemo(
    () =>
      liveSchedule.reduce(
        (sum, s) => sum + (s.drink?.carbs ?? 0) + (s.food?.carbs ?? 0),
        0
      ),
    [liveSchedule]
  );

  function enterEditMode() {
    if (!plan?.result) return;
    setEditCarbsPerHour(plan.carbsPerHour);
    setEditPlanBottles([...plan.bottles]);
    setEditBottles(
      plan.result.bottlePrep.map((b) => ({
        bottleId: b.bottleId,
        bottleIndex: b.bottleIndex,
        mlCapacity: b.mlCapacity,
        drinkProductId: b.drinkProductId ?? null,
        scoops: b.scoops,
      }))
    );
    setEditItems(plan.result.schedule.map((s) => ({ ...s })));
    setEditMode(true);
    setOpenPickerIdx(null);
    setRecalcMsg(null);
  }

  function cancelEdit() {
    setEditMode(false);
    setOpenPickerIdx(null);
    setRecalcMsg(null);
  }

  function setBottleDrink(idx: number, productId: string | null) {
    setRecalcMsg(null);
    setEditBottles((prev) =>
      prev.map((b, i) => {
        if (i !== idx) return b;
        const product = drinks.find((d) => d.id === productId);
        const defaultScoops = product
          ? Math.round((b.mlCapacity / product.mlPerServing) * product.scoopsRecommended)
          : 0;
        return { ...b, drinkProductId: productId, scoops: defaultScoops };
      })
    );
  }

  function stepBottleScoops(idx: number, delta: number) {
    setRecalcMsg(null);
    setEditBottles((prev) =>
      prev.map((b, i) =>
        i === idx ? { ...b, scoops: Math.max(1, b.scoops + delta) } : b
      )
    );
  }

  // Re-run the whole plan from the edited drink setup (each bottle's drink +
  // scoops) so solid food is re-added to fill whatever carb gap the drinks
  // leave. This is what lets "fewer scoops" translate into "more food".
  function recalculate() {
    if (!plan?.result) return;
    const bottleSetup = editPlanBottles.map((pb) => {
      const eb = editBottles.find((e) => e.bottleId === pb.id);
      return {
        bottleId: pb.id,
        mlCapacity: pb.mlCapacity,
        drinkProductId: eb?.drinkProductId ?? null,
        scoops: eb?.scoops ?? 0,
      };
    });
    const newResult = calculateFuelPlan({
      distance: plan.distance,
      avgSpeed: plan.avgSpeed,
      carbsPerHour: editCarbsPerHour,
      bottles: editPlanBottles,
      includeSolidFood: plan.includeSolidFood,
      includeCaffeine: plan.includeCaffeine,
      selectedDrinks: plan.selectedDrinks,
      selectedFoods: plan.selectedFoods,
      drinks,
      foods,
      weather: plan.weather,
      weightKg: profile.weightKg,
      intensity: plan.intensity,
      sweatRateMlPerHour: profile.sweatRateMlPerHour,
      bottleSetup,
    });
    setEditBottles(
      newResult.bottlePrep.map((b) => ({
        bottleId: b.bottleId,
        bottleIndex: b.bottleIndex,
        mlCapacity: b.mlCapacity,
        drinkProductId: b.drinkProductId ?? null,
        scoops: b.scoops,
      }))
    );
    setEditItems(newResult.schedule.map((s) => ({ ...s })));
    setOpenPickerIdx(null);
    const foodCount = newResult.schedule.filter((s) => s.food).length;
    const target = Math.round(newResult.durationHours * editCarbsPerHour);
    const delivered = newResult.schedule.reduce(
      (s, i) => s + (i.drink?.carbs ?? 0) + (i.food?.carbs ?? 0),
      0
    );
    if (!plan.includeSolidFood) {
      setRecalcMsg("Recalculated. Solid food is off for this plan — turn it on in a new plan to let food fill gaps.");
    } else if (foodCount > 0) {
      setRecalcMsg(`Recalculated — ${foodCount} food item${foodCount !== 1 ? "s" : ""} added to reach ${delivered}g (target ${target}g).`);
    } else {
      setRecalcMsg(`Recalculated — drinks already deliver ${delivered}g, covering your ${target}g target, so no food is needed.`);
    }
  }

  function removeFood(idx: number) {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, food: null } : item)));
    setOpenPickerIdx(null);
  }

  function setFood(idx: number, food: { name: string; carbs: number }) {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, food } : item)));
    setOpenPickerIdx(null);
  }

  function saveChanges() {
    if (!plan || !plan.result) return;
    const carbsChanged = editCarbsPerHour !== plan.carbsPerHour;
    const bottlesChanged =
      editPlanBottles.length !== plan.bottles.length ||
      editPlanBottles.some((b, i) => b.mlCapacity !== plan.bottles[i]?.mlCapacity);

    let updatedPlan: FuelPlan;
    if (carbsChanged || bottlesChanged) {
      const newResult = calculateFuelPlan({
        distance: plan.distance,
        avgSpeed: plan.avgSpeed,
        carbsPerHour: editCarbsPerHour,
        bottles: editPlanBottles,
        includeSolidFood: plan.includeSolidFood,
        includeCaffeine: plan.includeCaffeine,
        selectedDrinks: plan.selectedDrinks,
        selectedFoods: plan.selectedFoods,
        drinks,
        foods,
        weather: plan.weather,
        weightKg: profile.weightKg,
        intensity: plan.intensity,
        sweatRateMlPerHour: profile.sweatRateMlPerHour,
      });
      updatedPlan = { ...plan, carbsPerHour: editCarbsPerHour, bottles: editPlanBottles, result: newResult };
    } else {
      updatedPlan = {
        ...plan,
        result: { ...plan.result, bottlePrep: liveBottles, schedule: liveSchedule, totalCarbs: liveTotalCarbs },
      };
    }
    savePlan(updatedPlan);
    setPlan(updatedPlan);
    setEditMode(false);
    setOpenPickerIdx(null);
  }

  function handleGarminExport() {
    if (!plan?.result) return;
    const tcx = generateGarminTCX(plan);
    const blob = new Blob([tcx], { type: "application/vnd.garmin.tcx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel-plan-${plan.rideDate}.tcx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!plan || !plan.result) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-muted-foreground text-sm">Plan not found</p>
        </div>
      </div>
    );
  }

  const { result } = plan;
  const weatherMeta = plan.weather ? getWeatherLabel(plan.weather.tempC) : null;
  const displayBottles = editMode ? liveBottles : result.bottlePrep;
  const displaySchedule = editMode ? liveSchedule : result.schedule;
  const viewTotalCarbs = result.schedule.reduce(
    (sum, s) => sum + (s.drink?.carbs ?? 0) + (s.food?.carbs ?? 0),
    0
  );
  const displayTotalCarbs = editMode ? liveTotalCarbs : viewTotalCarbs;
  const fluidPerHour = Math.round(result.totalFluidMl / result.durationHours);
  const targetFluidMl = result.totalFluidMl;
  const actualFluidMl = editMode
    ? editPlanBottles.reduce((sum, b) => sum + b.mlCapacity, 0)
    : result.bottlePrep.reduce((sum, b) => sum + b.mlCapacity, 0);
  const fluidDiffMl = actualFluidMl - targetFluidMl;
  const displayCarbsPerHour = editMode ? editCarbsPerHour : plan.carbsPerHour;
  const targetCarbs = Math.round(result.durationHours * displayCarbsPerHour);
  const carbsDiff = displayTotalCarbs - targetCarbs;

  // --- Breakdown stats (live in edit mode too) ---
  const drinkCarbs = displaySchedule.reduce((sum, s) => sum + (s.drink?.carbs ?? 0), 0);
  const foodCarbs = displaySchedule.reduce((sum, s) => sum + (s.food?.carbs ?? 0), 0);
  const bottleCount = displayBottles.length;
  const foodItemsCount = displaySchedule.filter((s) => s.food).length;
  const carbSplitTotal = drinkCarbs + foodCarbs;
  const drinkPct = carbSplitTotal > 0 ? Math.round((drinkCarbs / carbSplitTotal) * 100) : 0;
  const foodPct = carbSplitTotal > 0 ? 100 - drinkPct : 0;
  const structuralChanges = editMode && (
    editCarbsPerHour !== plan.carbsPerHour ||
    editPlanBottles.length !== plan.bottles.length ||
    editPlanBottles.some((b, i) => b.mlCapacity !== plan.bottles[i]?.mlCapacity)
  );

  return (
    <div className="min-h-dvh bg-background pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          {editMode ? (
            <>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <span className="text-xs font-medium text-muted-foreground">Editing plan</span>
              <button
                onClick={saveChanges}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 p-2 -ml-2 rounded-xl hover:bg-muted transition-colors text-sm font-medium text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h1 className="font-display font-semibold text-foreground text-base">Your Fuel Plan</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={enterEditMode}
                  className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                  title="Edit plan"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => window.open(`/plan/${plan.id}/minimal`, "_blank")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Print
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {/* Summary card */}
        <div className="bg-primary rounded-3xl p-6 text-primary-foreground relative overflow-hidden animate-fade-up">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary-foreground/5 blur-xl" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="eyebrow text-primary-foreground/70">
                {format(parseISO(plan.rideDate), "EEEE, MMMM d")}
              </p>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <span className="font-display text-3xl font-semibold">{plan.distance} km</span>
                <span className="text-primary-foreground/60">·</span>
                <span className="text-primary-foreground/90">{formatDuration(result.durationHours)}</span>
              </div>
            </div>
            {plan.weather && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5">
                  <WeatherIcon icon={plan.weather.icon} className="h-5 w-5" />
                  <span className="font-display text-2xl font-semibold">{plan.weather.tempC}°C</span>
                </div>
                <span className="text-xs text-primary-foreground/70">{plan.weather.description}</span>
                {weatherMeta && (
                  <span className={`text-xs font-medium ${weatherMeta.color} bg-white/20 rounded-full px-2 py-0.5`}>
                    {weatherMeta.label}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-primary-foreground/20 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary-foreground/70 mb-0.5">
                <Flame className="h-3.5 w-3.5" />
                <span className="text-xs">Target/hr</span>
              </div>
              <p className="font-display text-xl font-semibold transition-all duration-300">{displayCarbsPerHour}g</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary-foreground/70 mb-0.5">
                <Bike className="h-3.5 w-3.5" />
                <span className="text-xs">Total carbs</span>
              </div>
              <p className="font-display text-xl font-semibold transition-all duration-300">{displayTotalCarbs}g</p>
              <p className={`text-[10px] mt-0.5 font-medium ${
                carbsDiff < -20 ? "text-amber-300" : "text-primary-foreground/50"
              }`}>
                {carbsDiff === 0
                  ? `target ${targetCarbs}g ✓`
                  : carbsDiff > 0
                  ? `target ${targetCarbs}g (+${carbsDiff}g)`
                  : `target ${targetCarbs}g (${carbsDiff}g)`}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary-foreground/70 mb-0.5">
                <Droplets className="h-3.5 w-3.5" />
                <span className="text-xs">Total water</span>
              </div>
              <p className="font-display text-xl font-semibold">{(actualFluidMl / 1000).toFixed(1)}L</p>
              <p className={`text-[10px] mt-0.5 font-medium ${
                fluidDiffMl < -250 ? "text-amber-300" : "text-primary-foreground/50"
              }`}>
                {fluidDiffMl === 0
                  ? `target ${(targetFluidMl / 1000).toFixed(1)}L ✓`
                  : fluidDiffMl > 0
                  ? `target ${(targetFluidMl / 1000).toFixed(1)}L (+${fluidDiffMl}ml)`
                  : `target ${(targetFluidMl / 1000).toFixed(1)}L (${fluidDiffMl}ml)`}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown — bottles, food items, and the drink/food carb split */}
        <section>
          <h2 className="eyebrow text-muted-foreground mb-3">At a glance</h2>
          <div className="bg-card border border-border rounded-3xl p-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Droplets className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="text-xs">Bottles</span>
                </div>
                <p className="font-display text-2xl font-semibold text-foreground">{bottleCount}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Bike className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="text-xs">Food items</span>
                </div>
                <p className="font-display text-2xl font-semibold text-foreground">{foodItemsCount}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                  <span className="text-xs">From drinks</span>
                </div>
                <p className="font-display text-2xl font-semibold text-foreground">
                  {drinkCarbs}<span className="text-sm font-normal text-muted-foreground">g</span>
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <span className="h-2 w-2 rounded-full bg-accent shrink-0" aria-hidden="true" />
                  <span className="text-xs">From food</span>
                </div>
                <p className="font-display text-2xl font-semibold text-foreground">
                  {foodCarbs}<span className="text-sm font-normal text-muted-foreground">g</span>
                </p>
              </div>
            </div>

            {carbSplitTotal > 0 && (
              <div className="mt-5">
                <div
                  className="flex h-2.5 rounded-full overflow-hidden bg-muted"
                  role="img"
                  aria-label={`Carbs: ${drinkPct}% from drinks, ${foodPct}% from food`}
                >
                  {drinkPct > 0 && <div className="bg-primary" style={{ width: `${drinkPct}%` }} />}
                  {foodPct > 0 && <div className="bg-accent" style={{ width: `${foodPct}%` }} />}
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                  <span>Drinks {drinkPct}%</span>
                  <span>Food {foodPct}%</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Pre-ride note */}
        {result.preRideNote && (
          <div className="flex gap-3 bg-peach-light border border-accent/20 rounded-2xl p-4">
            <Coffee className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-accent mb-0.5">Pre-ride fuel</p>
              <p className="text-sm text-foreground">{result.preRideNote}</p>
            </div>
          </div>
        )}

        {/* Caffeine note */}
        {result.caffeineNote && (
          <div className="flex gap-3 bg-peach-light border border-accent/20 rounded-2xl p-4">
            <span className="text-base leading-none mt-0.5">☕</span>
            <div>
              <p className="text-sm font-semibold text-accent mb-0.5">Caffeine</p>
              <p className="text-sm text-foreground">{result.caffeineNote}</p>
            </div>
          </div>
        )}

        {/* Electrolytes */}
        {(result.sodiumTargetMg ?? 0) > 0 &&
          (result.durationHours >= 1.5 || (plan.weather?.tempC ?? 0) > 25) && (
            <div className="flex gap-3 bg-card border border-border rounded-2xl p-4">
              <span className="text-base leading-none mt-0.5">🧂</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Electrolytes</p>
                  <p className="text-sm font-bold text-primary">
                    ~{result.sodiumDeliveredMg}mg
                    <span className="text-xs font-normal text-muted-foreground"> / ~{result.sodiumTargetMg}mg lost</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  You&apos;ll sweat out roughly {result.sodiumTargetMg}mg of sodium on this ride. Sodium helps you
                  absorb fluid and carbs and keeps cramp at bay — top up with an electrolyte mix or salty food
                  {(result.sodiumDeliveredMg ?? 0) < (result.sodiumTargetMg ?? 0) * 0.5 ? ", your current plan is light on it." : "."}
                </p>
              </div>
            </div>
          )}

        {/* Insights panel — calc warnings + smart suggestions */}
        {(() => {
          const extra = generateInsights(plan, result);
          const calcInsights: PlanInsight[] = result.warnings.map((w, i) => ({
            id: `calc-${i}`,
            level: "warning" as const,
            title: w.split(". ")[0] ?? w,
            detail: w,
          }));
          const allInsights = [...calcInsights, ...extra];
          if (allInsights.length === 0) return null;
          return (
            <div className="flex flex-col gap-2">
              {allInsights.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
              <Link href="/help" className="text-xs text-muted-foreground hover:text-primary hover:underline text-center py-1">
                Why these suggestions? Learn the science →
              </Link>
            </div>
          );
        })()}

        {/* Edit: Ride Setup — carb target + bottle sizes */}
        {editMode && (
          <section>
            <h2 className="eyebrow text-muted-foreground mb-3">
              Ride Setup
            </h2>
            <div className="rounded-2xl border border-primary/40 bg-card p-4 flex flex-col gap-5">
              {/* Carb target */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                  Carbs per hour
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {CARB_RATE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setEditCarbsPerHour(opt)}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-150 ${
                        editCarbsPerHour === opt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {opt}g
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottle sizes */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                  Bottles
                </p>
                <div className="flex flex-col gap-2">
                  {editPlanBottles.map((bottle, i) => (
                    <div key={bottle.id} className="flex items-center gap-3 bg-background rounded-xl border border-border px-3 py-2">
                      <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">
                        Bottle {i + 1}
                      </span>
                      <div className="flex-1">
                        <select
                          value={bottle.mlCapacity}
                          onChange={(e) =>
                            setEditPlanBottles((prev) =>
                              prev.map((b) => b.id === bottle.id ? { ...b, mlCapacity: Number(e.target.value) } : b)
                            )
                          }
                          className="w-full py-1.5 px-2 rounded-lg text-xs font-medium border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {BOTTLE_SIZE_OPTIONS.map((ml) => (
                            <option key={ml} value={ml}>{formatBottleSize(ml)}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() =>
                          editPlanBottles.length > 1 &&
                          setEditPlanBottles((prev) => prev.filter((b) => b.id !== bottle.id))
                        }
                        disabled={editPlanBottles.length <= 1}
                        className={`p-1 rounded-lg transition-colors shrink-0 ${
                          editPlanBottles.length > 1
                            ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            : "invisible"
                        }`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setEditPlanBottles((prev) => [
                        ...prev,
                        { id: generateId(), mlCapacity: 500 },
                      ])
                    }
                    className="flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Bottle
                  </button>
                </div>
              </div>

              {/* Recalculate notice */}
              {structuralChanges && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/10 rounded-xl border border-primary/20">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-xs font-medium text-primary">
                    Schedule will be fully recalculated when you save
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Bottle prep */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="eyebrow text-muted-foreground">
              🍼 Prep Your Bottles
            </h2>
            {editMode && (
              <span className="text-xs text-primary font-medium bg-sage-light px-2 py-1 rounded-lg">
                Tap to change drink
              </span>
            )}
          </div>
          <div className={`flex flex-col gap-2 ${editMode ? "rounded-2xl border border-primary/40 p-3 bg-card" : ""}`}>
            {displayBottles.map((bottle, bi) => {
              const eb = editMode ? editBottles[bi] : null;
              const product = eb ? drinks.find((d) => d.id === eb.drinkProductId) : null;

              return (
                <div key={bottle.bottleId} className={`${editMode ? "" : "bg-card border border-border rounded-2xl"} p-4`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
                        <Droplets className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Bottle {bottle.bottleIndex}</p>
                        <p className="text-xs text-muted-foreground">{bottle.mlCapacity}ml</p>
                      </div>
                    </div>
                    {bottle.carbsTotal > 0 && (
                      <span className="text-sm font-bold text-primary">{bottle.carbsTotal}g</span>
                    )}
                  </div>

                  {/* View mode: drink summary */}
                  {!editMode && (
                    <div className="mt-3 pl-10">
                      <p className="text-sm font-medium text-foreground">{bottle.drinkName}</p>
                      {bottle.scoops > 0 ? (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {bottle.scoops} scoop{bottle.scoops !== 1 ? "s" : ""} + {bottle.waterMl}ml water
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-0.5">{bottle.waterMl}ml water</p>
                      )}
                    </div>
                  )}

                  {/* Edit mode: drink selector + scoop stepper */}
                  {editMode && eb && (
                    <div className="mt-3 pl-10 flex flex-col gap-3">
                      {/* Drink chips */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setBottleDrink(bi, null)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
                            eb.drinkProductId === null
                              ? "bg-primary text-white border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          Water only
                        </button>
                        {drinks.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => setBottleDrink(bi, d.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${
                              eb.drinkProductId === d.id
                                ? "bg-primary text-white border-primary"
                                : "bg-background text-foreground border-border hover:border-primary/40"
                            }`}
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>

                      {/* Scoop stepper (only when a drink is selected) */}
                      {eb.drinkProductId !== null && product && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Scoops:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => stepBottleScoops(bi, -1)}
                              className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-border transition-colors"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold">{eb.scoops}</span>
                            <button
                              onClick={() => stepBottleScoops(bi, 1)}
                              className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-border transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="text-xs text-primary font-medium ml-auto">
                            → {liveBottles[bi]?.carbsTotal ?? 0}g carbs
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recalculate — rebuild the schedule (and re-fill food) from the
              edited drink setup. This is what turns "fewer scoops" into "more food". */}
          {editMode && (
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={recalculate}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-wide shadow-sm hover:bg-accent hover:shadow-md transition-all duration-300"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                Recalculate — fill food to match
              </button>
              <p aria-live="polite" className="text-xs px-1 text-center min-h-[1rem]">
                {recalcMsg ? (
                  <span className="text-primary font-medium">{recalcMsg}</span>
                ) : (
                  <span className="text-muted-foreground">
                    Changed scoops or drinks? Recalculate to re-fill solid food for the new carb gap.
                  </span>
                )}
              </p>
            </div>
          )}
        </section>

        {/* Schedule */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="eyebrow text-muted-foreground">
              🍌 On the Bike
            </h2>
            {editMode && (
              <span className="text-xs text-primary font-medium bg-sage-light px-2 py-1 rounded-lg">
                Tap rows to edit food
              </span>
            )}
          </div>

          {!sipHintDismissed && (
            <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 mb-3">
              <Info className="h-4 w-4 text-sky-500 shrink-0" />
              <p className="text-sm text-sky-800 flex-1">1 sip ≈ 50ml — a normal mouthful from a bottle.</p>
              <button
                onClick={() => {
                  setSipHintDismissed(true);
                  try { localStorage.setItem("sipHintDismissed", "1"); } catch { /* ignore */ }
                }}
                className="p-1 rounded-lg hover:bg-sky-100 text-sky-400 hover:text-sky-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className={`bg-card border rounded-2xl overflow-hidden ${editMode ? "border-primary/40" : "border-border"}`}>
            {displaySchedule.map((item, i) => {
              const isLast = i === displaySchedule.length - 1;
              const pickerOpen = editMode && openPickerIdx === i;

              return (
                <div key={i} className={!isLast ? "border-b border-border" : ""}>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <div className="shrink-0 w-16 text-right">
                      <p className="text-xs font-semibold text-foreground">{formatTime(item.timeMin)}</p>
                      <p className="text-xs text-muted-foreground">km {item.km}</p>
                    </div>
                    <div className="w-px bg-border self-stretch" />
                    <div className="flex-1 min-w-0">
                      {item.note && (
                        item.refill ? (
                          <div className="flex items-center gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            <p className="text-sm font-medium text-sky-700">{item.note}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{item.note}</p>
                        )
                      )}
                      {item.drink && (
                        <div className="flex items-center gap-1.5">
                          <Droplets className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="text-sm text-foreground">
                            <span className="font-medium">B{item.drink.bottleIndex}</span>{" "}
                            {item.drink.sips != null
                              ? `${item.drink.sips} sip${item.drink.sips !== 1 ? "s" : ""}`
                              : `${item.drink.mlAmount}ml`}
                            {item.drink.carbs > 0 && (
                              <span className="text-muted-foreground"> ({item.drink.carbs}g)</span>
                            )}
                            {item.drink.bottleFinished && (
                              <span className="text-amber-600 text-xs ml-1.5 font-medium">finish → next bottle</span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Food — view mode */}
                      {!editMode && item.food && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Bike className="h-3.5 w-3.5 text-accent shrink-0" />
                          <p className="text-sm text-foreground">
                            {item.food.name}{" "}
                            <span className="text-muted-foreground">({item.food.carbs}g)</span>
                          </p>
                        </div>
                      )}

                      {/* Food — edit mode */}
                      {editMode && !item.refill && (
                        <div className="mt-1">
                          {item.food ? (
                            <div className="flex items-center gap-2">
                              <Bike className="h-3.5 w-3.5 text-accent shrink-0" />
                              <span className="text-sm text-foreground flex-1">
                                {item.food.name}{" "}
                                <span className="text-muted-foreground">({item.food.carbs}g)</span>
                              </span>
                              <button
                                onClick={() => setOpenPickerIdx(pickerOpen ? null : i)}
                                className="text-xs text-primary underline"
                              >
                                change
                              </button>
                              <button
                                onClick={() => removeFood(i)}
                                className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setOpenPickerIdx(pickerOpen ? null : i)}
                              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-0.5"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add food
                            </button>
                          )}

                          {/* Food placement science validation */}
                          {item.food && (() => {
                            const totalMin = result.durationHours * 60;
                            const notes: string[] = [];
                            if (item.timeMin < 30)
                              notes.push("quite early (gut still warming up)");
                            if (item.timeMin > totalMin - 20)
                              notes.push("inside the last 20 min (may not digest in time)");
                            for (let j = 0; j < displaySchedule.length; j++) {
                              if (j !== i && displaySchedule[j].food) {
                                const gap = Math.abs(displaySchedule[j].timeMin - item.timeMin);
                                if (gap < 40) {
                                  notes.push(`~${gap} min after another item (tight for a bar, fine for a gel)`);
                                  break;
                                }
                              }
                            }
                            if (notes.length === 0) return null;
                            return (
                              <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="text-xs font-medium text-amber-700">
                                  Heads up: {notes.join(" · ")}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-primary">{item.cumulativeCarbs}g</p>
                      <p className="text-xs text-muted-foreground">total</p>
                    </div>
                  </div>

                  {/* Food picker */}
                  {pickerOpen && (
                    <div className="px-4 pb-3 pt-0 border-t border-dashed border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground font-medium mb-2 pt-2.5">Select food:</p>
                      {foods.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No foods in your list.{" "}
                          <button onClick={() => router.push("/settings")} className="text-primary underline">
                            Add in Settings
                          </button>
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {foods.map((food) => (
                            <button
                              key={food.id}
                              onClick={() => setFood(i, { name: food.name, carbs: food.carbsPerServing })}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all duration-150 ${
                                item.food?.name === food.name
                                  ? "bg-primary text-white border-primary"
                                  : "bg-card text-foreground border-border hover:border-primary/50"
                              }`}
                            >
                              {food.name}
                              <span className="ml-1 opacity-70">{food.carbsPerServing}g</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recovery note */}
        {!editMode && result.recoveryNote && (
          <div className="flex gap-3 bg-sage-light border border-primary/20 rounded-2xl p-4">
            <span className="text-base leading-none mt-0.5">🥣</span>
            <div>
              <p className="text-sm font-semibold text-primary mb-0.5">After the ride</p>
              <p className="text-sm text-foreground">{result.recoveryNote}</p>
            </div>
          </div>
        )}

        {/* Post-ride feedback — the learning loop */}
        {!editMode && plan.rideDate <= format(new Date(), "yyyy-MM-dd") && (
          <FeedbackSection
            key={plan.feedback?.recordedAt ?? "new-feedback"}
            plan={plan}
            onSave={(fb) => {
              const updated = { ...plan, feedback: fb };
              savePlan(updated);
              setPlan(updated);
            }}
          />
        )}

        {/* Open minimal view */}
        <button
          onClick={() => window.open(`/plan/${plan.id}/minimal`, "_blank")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Open Minimal / Print View
        </button>

        {/* Export to Garmin */}
        {!editMode && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleGarminExport}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Download className="h-4 w-4" />
              Export to Garmin (.tcx)
            </button>
            <p className="text-xs text-center text-muted-foreground px-2">
              Import in Garmin Connect → Training → Workouts → Import, then sync to your Edge
            </p>
          </div>
        )}

        {/* Delete plan */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete this plan
          </button>
        ) : (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-destructive text-center">
              Delete this plan permanently?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { deletePlan(plan.id); router.replace("/"); }}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

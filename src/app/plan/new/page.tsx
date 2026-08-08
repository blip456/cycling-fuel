"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Plus, Minus, X, Check, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { calculateFuelPlan, bottlesForRhythm, rhythmItemCount } from "@/lib/fuel-calculator";
import { geocodeLocation, fetchWeather, manualWeather } from "@/lib/weather";
import { LocationAutocomplete, type VerifiedLocation } from "@/components/location-autocomplete";
import { formatDuration, generateId, formatBottleSize } from "@/lib/utils";
import { calcMaxFoodItems } from "@/lib/plan-insights";
import { personalizedCarbTarget, fluidFeedbackHint, gutTrainingHint } from "@/lib/personalization";
import { CARB_RATE_OPTIONS, BOTTLE_SIZE_OPTIONS, FOOD_GAP_MIN, FOOD_TYPE_LABELS } from "@/lib/types";
import type { Bottle, SelectedDrink, FuelPlan, CarbRate, RideIntensity } from "@/lib/types";

const CARB_TIPS: Record<number, string> = {
  30: "Easy / leisure pace. A light mix or one snack per hour covers it.",
  45: "Comfortable endurance rides up to ~3hrs. Single carb source is fine.",
  60: "Steady 2–3hr rides. Max absorption with one carb type.",
  70: "Gut-training zone. Build up gradually with a glucose + fructose (2:1) mix.",
  80: "Gut-training zone. Mixed glucose + fructose (2:1) recommended.",
  90: "Hard or long rides (3hr+). Use a drink with glucose + fructose (2:1 ratio).",
  120: "Racing intakes. Requires gut training and 1:1 glucose:fructose.",
};


const INTENSITY_OPTIONS: { value: RideIntensity; label: string; desc: string }[] = [
  { value: "easy", label: "Easy", desc: "Leisure pace, you can chat" },
  { value: "steady", label: "Steady", desc: "Endurance pace, working" },
  { value: "hard", label: "Hard", desc: "Race or fast group" },
];

interface WizardData {
  distance: string;
  avgSpeed: string;
  rideDate: string;
  location: string;
  locationGeo: VerifiedLocation | null;
  intensity: RideIntensity;
  carbsPerHour: CarbRate;
  bottles: Bottle[];
  includeSolidFood: boolean;
  includeCaffeine: boolean;
  manualTempC: string;
  selectedDrinks: SelectedDrink[];
  selectedFoods: string[];
}

const today = format(new Date(), "yyyy-MM-dd");
const DRAFT_KEY = "cyclefuel-wizard-draft";

function loadDraft(): Partial<WizardData> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NewPlanPage() {
  const router = useRouter();
  const { profile, drinks, foods, plans, savePlan } = useStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const initialized = useRef(false);

  const [data, setData] = useState<WizardData>(() => {
    const defaults: WizardData = {
      distance: "",
      avgSpeed: "",
      rideDate: today,
      location: "",
      locationGeo: null,
      intensity: profile.defaultIntensity ?? "steady",
      carbsPerHour: profile.defaultCarbsPerHour,
      bottles: [{ id: generateId(), mlCapacity: profile.defaultBottleMl }],
      includeSolidFood: true,
      includeCaffeine: false,
      manualTempC: "",
      selectedDrinks: drinks.map((d) => ({ productId: d.id, scoopsOverride: undefined })),
      selectedFoods: foods.map((f) => f.id),
    };
    if (typeof window === "undefined") return defaults;
    const draft = loadDraft();
    return draft ? { ...defaults, ...draft } : defaults;
  });

  // Persist draft on every change
  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return; }
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);

  const distanceNum = parseFloat(data.distance.replace(",", ".")) || 0;
  const speedNum = parseFloat(data.avgSpeed.replace(",", ".")) || 0;
  const duration = speedNum > 0 ? distanceNum / speedNum : 0;

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function addBottle() {
    update("bottles", [
      ...data.bottles,
      { id: generateId(), mlCapacity: profile.defaultBottleMl },
    ]);
  }

  function removeBottle(id: string) {
    if (data.bottles.length <= 1) return;
    update("bottles", data.bottles.filter((b) => b.id !== id));
  }

  function updateBottleSize(id: string, ml: number) {
    update(
      "bottles",
      data.bottles.map((b) => (b.id === id ? { ...b, mlCapacity: ml } : b))
    );
  }

  function toggleDrink(productId: string) {
    const exists = data.selectedDrinks.find((d) => d.productId === productId);
    if (exists) {
      update("selectedDrinks", data.selectedDrinks.filter((d) => d.productId !== productId));
    } else {
      update("selectedDrinks", [...data.selectedDrinks, { productId }]);
    }
  }

  function updateScoops(productId: string, delta: number) {
    const drink = drinks.find((d) => d.id === productId);
    if (!drink) return;
    const sd = data.selectedDrinks.find((d) => d.productId === productId);
    const current = sd?.scoopsOverride ?? drink.scoopsRecommended;
    const next = Math.max(1, current + delta);
    update(
      "selectedDrinks",
      data.selectedDrinks.map((d) =>
        d.productId === productId ? { ...d, scoopsOverride: next } : d
      )
    );
  }

  function toggleFood(foodId: string) {
    if (data.selectedFoods.includes(foodId)) {
      update("selectedFoods", data.selectedFoods.filter((id) => id !== foodId));
    } else {
      update("selectedFoods", [...data.selectedFoods, foodId]);
    }
  }

  function canProceedStep1() {
    return distanceNum > 0 && speedNum > 0 && data.rideDate;
  }

  function canProceedStep2() {
    return data.bottles.length > 0;
  }

  async function handleGenerate() {
    setLoading(true);
    setLocationError("");

    let lat: number | undefined;
    let lng: number | undefined;
    let weather = undefined;

    if (data.locationGeo) {
      // User picked a verified suggestion — use its exact coordinates
      lat = data.locationGeo.lat;
      lng = data.locationGeo.lng;
      try {
        weather = await fetchWeather(lat, lng, data.rideDate) ?? undefined;
      } catch {
        // weather is optional; continue without it
      }
    } else if (data.location.trim()) {
      // Free-typed text: best-effort geocode of the top match
      try {
        const geo = await geocodeLocation(data.location);
        if (geo) {
          lat = geo.latitude;
          lng = geo.longitude;
          weather = await fetchWeather(lat, lng, data.rideDate) ?? undefined;
        }
      } catch {
        // weather is optional; continue without it
      }
    }

    // Fall back to a hand-entered temperature when there's no forecast (indoor,
    // beyond the forecast horizon, or no location given).
    const manualTemp = parseFloat(data.manualTempC.replace(",", "."));
    if (!weather && !isNaN(manualTemp)) {
      weather = manualWeather(manualTemp);
    }

    const planId = generateId();
    // A bottle rhythm needs more fills than the rider configured — materialise
    // them now so the plan's bottle list and its bottle prep never disagree.
    const planBottles = bottlesForRhythm(data.bottles, duration, profile.fuelAnchor, generateId);
    const result = calculateFuelPlan({
      distance: distanceNum,
      avgSpeed: speedNum,
      carbsPerHour: data.carbsPerHour,
      bottles: planBottles,
      bottlesCarried: data.bottles.length,
      includeSolidFood: data.includeSolidFood,
      includeCaffeine: data.includeCaffeine,
      selectedDrinks: data.selectedDrinks,
      selectedFoods: data.selectedFoods,
      drinks,
      foods,
      weather,
      weightKg: profile.weightKg,
      intensity: data.intensity,
      sweatRateMlPerHour: profile.sweatRateMlPerHour,
      fuelAnchor: profile.fuelAnchor,
    });

    const plan: FuelPlan = {
      id: planId,
      createdAt: new Date().toISOString(),
      rideDate: data.rideDate,
      distance: distanceNum,
      avgSpeed: speedNum,
      location: data.location,
      lat,
      lng,
      weather,
      calcWeather: weather,
      carbsPerHour: data.carbsPerHour,
      intensity: data.intensity,
      bottles: planBottles,
      bottlesCarried: data.bottles.length,
      fuelAnchor: profile.fuelAnchor,
      includeSolidFood: data.includeSolidFood,
      includeCaffeine: data.includeCaffeine,
      selectedDrinks: data.selectedDrinks,
      selectedFoods: data.selectedFoods,
      result,
    };

    savePlan(plan);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    router.push(`/plan/${planId}`);
  }

  const stepTitles = ["Ride Details", "Fueling & Hydration", "Choose Products"];
  const stepProgress = (step / 3) * 100;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="eyebrow text-sage">
              Step {step} of 3 · <span className="text-muted-foreground normal-case tracking-normal font-normal">{stepTitles[step - 1]}</span>
            </p>
            <Progress value={stepProgress} className="mt-1.5 h-1" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-wizard">
        {/* STEP 1: Ride Details */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="font-display text-3xl font-semibold text-foreground">Ride <em className="text-primary">details</em></h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Tell us about the ride so we can calculate your fueling window.
              </p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="distance" className="mb-2 block">Distance</Label>
                <div className="relative">
                  <Input
                    id="distance"
                    type="text"
                    inputMode="decimal"
                    placeholder="80"
                    value={data.distance}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^[0-9]*[.,]?[0-9]*$/.test(v)) update("distance", v);
                    }}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km</span>
                </div>
              </div>
              <div className="flex-1">
                <Label htmlFor="speed" className="mb-2 block">Avg Speed</Label>
                <div className="relative">
                  <Input
                    id="speed"
                    type="text"
                    inputMode="decimal"
                    placeholder="28"
                    value={data.avgSpeed}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^[0-9]*[.,]?[0-9]*$/.test(v)) update("avgSpeed", v);
                    }}
                    className="pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">km/h</span>
                </div>
              </div>
            </div>

            {duration > 0 && (
              <div className="inline-flex items-center gap-2 self-start px-4 py-2 bg-sage-light rounded-full">
                <span className="text-sm text-primary font-medium">
                  Estimated ride time · <span className="font-display font-semibold">{formatDuration(duration)}</span>
                </span>
              </div>
            )}

            <div>
              <Label className="mb-2 block">How hard will you ride?</Label>
              <div className="grid grid-cols-3 gap-2">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("intensity", opt.value)}
                    className={`py-2.5 px-2 rounded-xl border-2 transition-all duration-150 text-center ${
                      data.intensity === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{opt.label}</span>
                    <span className={`block text-[10px] mt-0.5 leading-tight ${
                      data.intensity === opt.value ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Effort level changes how many carbs per hour we recommend.
              </p>
            </div>

            <div>
              <Label htmlFor="date" className="mb-2 block">Date of Ride</Label>
              <Input
                id="date"
                type="date"
                value={data.rideDate}
                min={today}
                onChange={(e) => update("rideDate", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="location" className="mb-2 block">
                Starting Location
                <span className="text-muted-foreground font-normal ml-1">(optional, for weather)</span>
              </Label>
              <LocationAutocomplete
                id="location"
                placeholder="e.g. Ghent, Belgium"
                value={data.location}
                verified={data.locationGeo}
                onTextChange={(text) => {
                  setData((d) => ({
                    ...d,
                    location: text,
                    // typing invalidates a previous selection
                    locationGeo: d.locationGeo && d.locationGeo.label === text ? d.locationGeo : null,
                  }));
                  setLocationError("");
                }}
                onSelect={(loc) =>
                  setData((d) => ({ ...d, location: loc.label, locationGeo: loc }))
                }
              />
              {locationError && <p className="text-xs text-destructive mt-1">{locationError}</p>}
              {!data.location.trim() && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  We&apos;ll fetch the forecast for this location and date.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="manualTemp" className="mb-2 block">
                Temperature
                <span className="text-muted-foreground font-normal ml-1">(optional — used if no forecast)</span>
              </Label>
              <div className="relative">
                <Input
                  id="manualTemp"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 18"
                  value={data.manualTempC}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^-?[0-9]*[.,]?[0-9]*$/.test(v)) update("manualTempC", v);
                  }}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">°C</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Handy for indoor rides or dates beyond the forecast. A live forecast takes priority.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Fueling & Hydration */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-3xl font-semibold text-foreground">Fueling &amp; <em className="text-primary">hydration</em></h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Set your carb target and bottle setup for the ride.
              </p>
            </div>

            {/* Carbs per hour */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="mb-0">Carbs per Hour</Label>
                <Link href="/help#carbs" className="text-xs font-medium text-primary hover:underline">
                  Why these numbers?
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {CARB_RATE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => update("carbsPerHour", opt)}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 ${
                      data.carbsPerHour === opt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {opt}g
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 px-1">{CARB_TIPS[data.carbsPerHour]}</p>

              {/* Personalized carb suggestion (science baseline + your feedback) */}
              {(() => {
                if (duration <= 0) return null;
                const suggestion = personalizedCarbTarget(duration, data.intensity, plans);
                if (data.carbsPerHour === suggestion.suggested) return null;
                const tooLow = data.carbsPerHour < suggestion.suggested;
                const palette = tooLow
                  ? { wrap: "bg-amber-50 border-amber-200", icon: "text-amber-500", title: "text-amber-800", body: "text-amber-700", btn: "text-amber-700 bg-amber-100 hover:bg-amber-200" }
                  : { wrap: "bg-sky-50 border-sky-200", icon: "text-sky-500", title: "text-sky-800", body: "text-sky-700", btn: "text-sky-700 bg-sky-100 hover:bg-sky-200" };
                const Icon = tooLow ? AlertTriangle : Info;
                return (
                  <div className={`mt-3 rounded-xl border px-3.5 py-3 flex items-start gap-3 ${palette.wrap}`}>
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${palette.icon}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${palette.title}`}>
                        {suggestion.suggested}g/hr suggested for a {data.intensity} {formatDuration(duration)} ride
                      </p>
                      <p className={`text-xs mt-0.5 ${palette.body}`}>
                        {tooLow
                          ? `At ${data.carbsPerHour}g/hr energy may fade before the finish. `
                          : `${data.carbsPerHour}g/hr is more than this effort needs. `}
                        {suggestion.feedbackCount > 0 ? suggestion.reason : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update("carbsPerHour", suggestion.suggested)}
                      className={`shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${palette.btn}`}
                    >
                      Set {suggestion.suggested}g →
                    </button>
                  </div>
                );
              })()}

              {/* Gut-training progression — nudge intake up once it's comfortable */}
              {(() => {
                const hint = gutTrainingHint(plans, data.intensity);
                if (!hint || data.carbsPerHour >= hint.suggested) return null;
                return (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-sage-light px-3.5 py-3 flex items-start gap-3">
                    <span className="text-base leading-none mt-0.5">💪</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary">Train your gut: try {hint.suggested}g/hr</p>
                      <p className="text-xs text-foreground/80 mt-0.5">{hint.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update("carbsPerHour", hint.suggested)}
                      className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                    >
                      Set {hint.suggested}g →
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Bottles */}
            <div>
              <Label className="mb-3 block">My Bottles</Label>
              <div className="flex flex-col gap-2">
                {data.bottles.map((bottle, i) => (
                  <div key={bottle.id} className="flex items-center gap-3 bg-card rounded-xl border border-border px-3 py-2.5">
                    <span className="text-sm text-muted-foreground font-medium w-16 shrink-0">Bottle {i + 1}</span>
                    <div className="flex-1">
                      <select
                        value={bottle.mlCapacity}
                        onChange={(e) => updateBottleSize(bottle.id, Number(e.target.value))}
                        className="w-full py-2 px-2.5 rounded-lg text-sm font-medium border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {BOTTLE_SIZE_OPTIONS.map((ml) => (
                          <option key={ml} value={ml}>{formatBottleSize(ml)}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeBottle(bottle.id)}
                      disabled={data.bottles.length <= 1}
                      className={`p-1 rounded-lg transition-colors shrink-0 ${
                        data.bottles.length > 1
                          ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          : "invisible"
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addBottle}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Bottle
                </button>
              </div>
            </div>

            {/* Fueling rhythm — what it will fix first for this ride */}
            {(() => {
              const anchor = profile.fuelAnchor;
              if (!anchor || anchor.perHour <= 0 || duration <= 0) return null;
              const count = rhythmItemCount(duration, anchor);
              const size = data.bottles[0]?.mlCapacity ?? profile.defaultBottleMl;
              const short = anchor.type === "drink" ? count - data.bottles.length : 0;
              return (
                <div className="rounded-xl bg-sage-light border border-primary/20 px-3.5 py-3 flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary">Your fueling rhythm applies</p>
                    <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">
                      {anchor.type === "drink"
                        ? `${count} × ${formatBottleSize(size)} of mix is counted first on this ${formatDuration(duration)} ride; solid food fills whatever carbs are left.` +
                          (short > 0
                            ? ` Your plan will list all ${count} fills — ${short} more than the bottles above, so pack powder to remix en route.`
                            : short < 0
                            ? ` The other ${-short} bottle${-short !== 1 ? "s" : ""} ride along as plain water.`
                            : "")
                        : `${count} solid item${count !== 1 ? "s" : ""} ${count !== 1 ? "are" : "is"} counted first on this ${formatDuration(duration)} ride; your bottles are then mixed to cover the remaining carbs.`}
                    </p>
                    <Link href="/settings" className="inline-block mt-1 text-xs font-semibold text-primary hover:underline">
                      Change in Settings →
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* Bottle volume hint */}
            {(() => {
              if (duration <= 0) return null;
              const totalMl = data.bottles.reduce((s, b) => s + b.mlCapacity, 0);
              const perHour = profile.sweatRateMlPerHour && profile.sweatRateMlPerHour > 0
                ? profile.sweatRateMlPerHour
                : 500;
              const estimatedMl = Math.round(duration * perHour);
              if (totalMl >= estimatedMl * 0.75) return null;
              const basis = profile.sweatRateMlPerHour && profile.sweatRateMlPerHour > 0
                ? "your sweat rate"
                : "500ml/hr baseline";
              return (
                <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-3 flex items-start gap-3">
                  <Info className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-sky-800">Bottles may be short on fluid</p>
                    <p className="text-xs text-sky-700 mt-0.5">
                      {formatDuration(duration)} ride needs ~{(estimatedMl / 1000).toFixed(1)}L ({perHour}ml/hr, {basis}).
                      You have {(totalMl / 1000).toFixed(1)}L — you can refill en route or add a bottle.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Hydration hint learned from past ride feedback */}
            {(() => {
              const hint = fluidFeedbackHint(plans, data.intensity);
              if (!hint) return null;
              return (
                <div className="rounded-xl bg-sage-light border border-primary/20 px-3.5 py-3 flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-primary">From your ride feedback</p>
                    <p className="text-xs text-foreground/80 mt-0.5">{hint}</p>
                  </div>
                </div>
              );
            })()}

            {/* Solid food */}
            <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-foreground">Include Solid Food?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bars, gels, bananas, etc.</p>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-border">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => update("includeSolidFood", val)}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                      data.includeSolidFood === val
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Caffeine */}
            <div className="flex items-center justify-between bg-card rounded-xl border border-border px-4 py-3.5">
              <div className="min-w-0 pr-3">
                <p className="text-sm font-medium text-foreground">Caffeine plan?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Evidence-based timing (~3mg/kg pre-ride).</p>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-border shrink-0">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => update("includeCaffeine", val)}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                      data.includeCaffeine === val
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Products */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-3xl font-semibold text-foreground">Choose <em className="text-primary">products</em></h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Select what you&apos;ll bring. Adjust scoops if you mix differently.
              </p>
            </div>

            {/* Drinks */}
            <div>
              <Label className="mb-3 block">Drinks</Label>
              {drinks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No drinks configured.{" "}
                  <button onClick={() => router.push("/settings")} className="text-primary underline">
                    Add drinks in Settings
                  </button>
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {drinks.map((drink) => {
                    const sd = data.selectedDrinks.find((d) => d.productId === drink.id);
                    const isSelected = !!sd;
                    const scoops = sd?.scoopsOverride ?? drink.scoopsRecommended;
                    const carbsForScoops = Math.round((scoops / drink.scoopsRecommended) * drink.carbsPerServing);

                    return (
                      <div
                        key={drink.id}
                        className={`rounded-xl border-2 transition-all duration-150 overflow-hidden ${
                          isSelected ? "border-primary bg-sage-light" : "border-border bg-card"
                        }`}
                      >
                        <button
                          className="w-full flex items-start gap-3 p-3.5 text-left"
                          onClick={() => toggleDrink(drink.id)}
                        >
                          <div className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isSelected ? "bg-primary border-primary" : "border-border bg-card"
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{drink.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {drink.scoopsRecommended} scoops / {drink.mlPerServing}ml · {drink.carbsPerServing}g carbs · {drink.carbRatio} ratio
                            </p>
                            {drink.flavour && (
                              <p className="text-xs text-muted-foreground">{drink.flavour}</p>
                            )}
                          </div>
                        </button>

                        {isSelected && (
                          <div className="px-3.5 pb-3.5 pt-0 flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Scoops:</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateScoops(drink.id, -1)}
                                className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold">{scoops}</span>
                              <button
                                onClick={() => updateScoops(drink.id, 1)}
                                className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-xs text-primary font-medium ml-auto">
                              → {carbsForScoops}g carbs / serving
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drink ratio warning */}
            {(() => {
              if (data.carbsPerHour < 90 || data.selectedDrinks.length === 0) return null;
              const selectedProducts = data.selectedDrinks
                .map((sd) => drinks.find((d) => d.id === sd.productId))
                .filter(Boolean);
              if (selectedProducts.length === 0) return null;
              const allSingle = selectedProducts.every((d) => d!.carbRatio === "single");
              const noOneToOne = data.carbsPerHour >= 120 && selectedProducts.every((d) => d!.carbRatio !== "1:1");
              if (!allSingle && !noOneToOne) return null;
              return (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      {allSingle
                        ? "Single-source drinks can't support 90g/hr"
                        : "120g/hr performs best with a 1:1 ratio drink"}
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">
                      {allSingle
                        ? "SGLT1 saturates at ~60g/hr. Without fructose (2:1 or 1:1 ratio), excess glucose causes GI distress."
                        : "At 120g/hr, equal glucose:fructose (1:1) fully saturates both SGLT1 and GLUT5 transporters."}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Solid Foods */}
            {data.includeSolidFood && (
              <div>
                <Label className="mb-3 block">Solid Foods</Label>
                {foods.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No foods configured.{" "}
                    <button onClick={() => router.push("/settings")} className="text-primary underline">
                      Add foods in Settings
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {foods.map((food) => {
                      const isSelected = data.selectedFoods.includes(food.id);
                      return (
                        <button
                          key={food.id}
                          onClick={() => toggleFood(food.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150 ${
                            isSelected ? "border-primary bg-sage-light" : "border-border bg-card"
                          }`}
                        >
                          <div className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isSelected ? "bg-primary border-primary" : "border-border bg-card"
                          }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{food.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {FOOD_TYPE_LABELS[food.type ?? "bar"]}
                              {food.brand ? ` · ${food.brand}` : ""}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-primary shrink-0">{food.carbsPerServing}g</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Food count vs schedule capacity */}
                {(() => {
                  if (duration <= 0 || data.selectedFoods.length === 0) return null;
                  const chosen = data.selectedFoods
                    .map((id) => foods.find((f) => f.id === id))
                    .filter(Boolean) as { type?: keyof typeof FOOD_GAP_MIN }[];
                  const avgGap = chosen.length
                    ? Math.round(chosen.reduce((s, f) => s + FOOD_GAP_MIN[f.type ?? "bar"], 0) / chosen.length)
                    : 50;
                  const maxItems = calcMaxFoodItems(duration, avgGap);
                  const selected = data.selectedFoods.length;
                  if (selected <= maxItems) {
                    return (
                      <p className="text-xs text-muted-foreground mt-2 px-1">
                        {selected} item{selected !== 1 ? "s" : ""} selected · schedule fits up to {maxItems} in feed window
                      </p>
                    );
                  }
                  const dropped = selected - maxItems;
                  return (
                    <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        Only <strong>{maxItems}</strong> item{maxItems !== 1 ? "s" : ""} fit in the feed window
                        ({dropped} will be dropped — 50-min spacing + 20-min cutoff rule).
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer button — floats above the nav, same width, seamless paper bg */}
      <div className="pointer-events-none fixed bottom-above-nav left-0 right-0 z-50 px-5 pt-8 pb-3 max-w-lg mx-auto bg-gradient-to-t from-background via-background to-transparent">
        {step < 3 ? (
          <Button
            className="w-full pointer-events-auto"
            size="lg"
            disabled={step === 1 ? !canProceedStep1() : !canProceedStep2()}
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="w-full pointer-events-auto bg-accent hover:bg-accent/90 text-accent-foreground"
            size="lg"
            disabled={loading}
            onClick={handleGenerate}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating…
              </>
            ) : (
              "Generate My Plan"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

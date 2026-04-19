"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin, Loader2, Plus, Minus, X, Check } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";
import { calculateFuelPlan } from "@/lib/fuel-calculator";
import { geocodeLocation, fetchWeather } from "@/lib/weather";
import { formatDuration, generateId } from "@/lib/utils";
import type { Bottle, SelectedDrink, FuelPlan } from "@/lib/types";

const CARB_OPTIONS = [45, 60, 90, 120] as const;
const BOTTLE_SIZES = [500, 750, 1000] as const;

const CARB_TIPS: Record<number, string> = {
  45: "Light rides under 90 min or low intensity. Single carb source is fine.",
  60: "Solid choice for 1–2hr rides. Max absorption with one carb type.",
  90: "Best for 2–4hr rides. Use a drink with glucose + fructose (2:1 ratio).",
  120: "Long or high-intensity rides. Requires gut training and 1:1 glucose:fructose.",
};

interface WizardData {
  distance: string;
  avgSpeed: string;
  rideDate: string;
  location: string;
  carbsPerHour: 45 | 60 | 90 | 120;
  bottles: Bottle[];
  includeSolidFood: boolean;
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
  const { profile, drinks, foods, savePlan } = useStore();
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
      carbsPerHour: profile.defaultCarbsPerHour,
      bottles: [{ id: generateId(), mlCapacity: profile.defaultBottleMl }],
      includeSolidFood: true,
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

  function updateBottleSize(id: string, ml: 500 | 750 | 1000) {
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

    if (data.location.trim()) {
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

    const planId = generateId();
    const result = calculateFuelPlan({
      distance: distanceNum,
      avgSpeed: speedNum,
      carbsPerHour: data.carbsPerHour,
      bottles: data.bottles,
      includeSolidFood: data.includeSolidFood,
      selectedDrinks: data.selectedDrinks,
      selectedFoods: data.selectedFoods,
      drinks,
      foods,
      weather,
      weightKg: profile.weightKg,
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
      carbsPerHour: data.carbsPerHour,
      bottles: data.bottles,
      includeSolidFood: data.includeSolidFood,
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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
            className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">
              Step {step} of 3 — {stepTitles[step - 1]}
            </p>
            <Progress value={stepProgress} className="mt-1.5 h-1.5" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-wizard">
        {/* STEP 1: Ride Details */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Ride Details</h2>
              <p className="text-sm text-muted-foreground mt-1">
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
              <div className="flex items-center gap-2 px-3 py-2 bg-sage-light rounded-xl">
                <span className="text-sm text-primary font-medium">
                  Estimated ride time: {formatDuration(duration)}
                </span>
              </div>
            )}

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
              <div className="relative">
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g. Ghent, Belgium"
                  value={data.location}
                  onChange={(e) => { update("location", e.target.value); setLocationError(""); }}
                  className="pr-9"
                />
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {locationError && <p className="text-xs text-destructive mt-1">{locationError}</p>}
              <p className="text-xs text-muted-foreground mt-1.5">
                We&apos;ll fetch the forecast for this location and date.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Fueling & Hydration */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Fueling & Hydration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Set your carb target and bottle setup for the ride.
              </p>
            </div>

            {/* Carbs per hour */}
            <div>
              <Label className="mb-3 block">Carbs per Hour</Label>
              <div className="grid grid-cols-4 gap-2">
                {CARB_OPTIONS.map((opt) => (
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
            </div>

            {/* Bottles */}
            <div>
              <Label className="mb-3 block">My Bottles</Label>
              <div className="flex flex-col gap-2">
                {data.bottles.map((bottle, i) => (
                  <div key={bottle.id} className="flex items-center gap-3 bg-card rounded-xl border border-border px-3 py-2.5">
                    <span className="text-sm text-muted-foreground font-medium w-16 shrink-0">Bottle {i + 1}</span>
                    <div className="flex-1 flex gap-1">
                      {BOTTLE_SIZES.map((ml) => (
                        <button
                          key={ml}
                          onClick={() => updateBottleSize(bottle.id, ml)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                            bottle.mlCapacity === ml
                              ? "bg-primary text-white border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {ml}ml
                        </button>
                      ))}
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
          </div>
        )}

        {/* STEP 3: Products */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Choose Products</h2>
              <p className="text-sm text-muted-foreground mt-1">
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
                            {food.brand && <p className="text-xs text-muted-foreground">{food.brand}</p>}
                          </div>
                          <span className="text-sm font-semibold text-primary shrink-0">{food.carbsPerServing}g</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer buttons — sits above the bottom nav */}
      <div className="fixed bottom-above-nav left-0 right-0 z-50 bg-card border-t border-border px-4 py-3 max-w-lg mx-auto">
        {step < 3 ? (
          <Button
            className="w-full"
            size="lg"
            disabled={step === 1 ? !canProceedStep1() : !canProceedStep2()}
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
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

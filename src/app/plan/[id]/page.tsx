"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Sun, Cloud, CloudRain, CloudLightning,
  Snowflake, Wind, Droplets, Flame, AlertTriangle, Bike, Coffee,
  Pencil, X, Plus, Check, Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { formatDuration, formatTime } from "@/lib/utils";
import type { FuelPlan, ScheduleItem, WeatherData } from "@/lib/types";

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

function getWeatherLabel(tempC: number) {
  if (tempC < 10) return { label: "Cold", color: "text-blue-500" };
  if (tempC < 18) return { label: "Cool", color: "text-sky-500" };
  if (tempC < 26) return { label: "Moderate", color: "text-green-600" };
  return { label: "Hot — stay hydrated!", color: "text-orange-500" };
}

// Local edit state: food can be null = explicitly cleared
type EditItem = {
  timeMin: number;
  km: number;
  drink?: ScheduleItem["drink"];
  food?: { name: string; carbs: number } | null;
  note?: string;
};

export default function PlanResultPage() {
  const params = useParams();
  const router = useRouter();
  const { getPlan, savePlan, deletePlan, foods } = useStore();
  const [plan, setPlan] = useState<FuelPlan | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);

  useEffect(() => {
    const found = getPlan(params.id as string);
    if (found) setPlan(found);
    else router.replace("/");
  }, [params.id, getPlan, router]);

  // Live carb recalculation as user edits
  const liveSchedule = useMemo(() => {
    let cum = 0;
    return editItems.map((item) => {
      cum += (item.drink?.carbs ?? 0) + (item.food?.carbs ?? 0);
      return { ...item, cumulativeCarbs: cum, food: item.food ?? undefined };
    });
  }, [editItems]);

  const liveTotalCarbs =
    liveSchedule.length > 0
      ? liveSchedule[liveSchedule.length - 1].cumulativeCarbs
      : (plan?.result?.totalCarbs ?? 0);

  function enterEditMode() {
    if (!plan?.result) return;
    setEditItems(plan.result.schedule.map((s) => ({ ...s })));
    setEditMode(true);
    setOpenPickerIdx(null);
  }

  function cancelEdit() {
    setEditMode(false);
    setOpenPickerIdx(null);
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
    const updatedPlan: FuelPlan = {
      ...plan,
      result: {
        ...plan.result,
        schedule: liveSchedule,
        totalCarbs: liveTotalCarbs,
      },
    };
    savePlan(updatedPlan);
    setPlan(updatedPlan);
    setEditMode(false);
    setOpenPickerIdx(null);
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
  const displaySchedule = editMode ? liveSchedule : result.schedule;
  const displayTotalCarbs = editMode ? liveTotalCarbs : result.totalCarbs;
  // Total fluid in bottles = what the schedule actually distributes
  const inBottlesMl = result.bottlePrep.reduce((sum, b) => sum + b.mlCapacity, 0);

  return (
    <div className="min-h-dvh bg-background pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
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
              <span className="text-xs font-medium text-muted-foreground">Editing schedule</span>
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
              <h1 className="font-semibold text-foreground text-sm">Your Fuel Plan</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={enterEditMode}
                  className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                  title="Edit schedule"
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

      <div className="px-4 py-5 flex flex-col gap-5">
        {/* Summary card */}
        <div className="bg-primary rounded-2xl p-4 text-primary-foreground">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wide">
                {format(parseISO(plan.rideDate), "EEEE, MMMM d")}
              </p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">{plan.distance} km</span>
                <span className="text-primary-foreground/70">·</span>
                <span className="text-primary-foreground/90">{formatDuration(result.durationHours)}</span>
              </div>
            </div>
            {plan.weather && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5">
                  <WeatherIcon icon={plan.weather.icon} className="h-5 w-5" />
                  <span className="font-bold text-lg">{plan.weather.tempC}°C</span>
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
              <p className="font-bold">{plan.carbsPerHour}g</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary-foreground/70 mb-0.5">
                <Bike className="h-3.5 w-3.5" />
                <span className="text-xs">Total carbs</span>
              </div>
              <p className="font-bold transition-all duration-150">{displayTotalCarbs}g</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary-foreground/70 mb-0.5">
                <Droplets className="h-3.5 w-3.5" />
                <span className="text-xs">In bottles</span>
              </div>
              <p className="font-bold">{Math.round(inBottlesMl / 100) / 10}L</p>
            </div>
          </div>
        </div>

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

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="flex flex-col gap-2">
            {result.warnings.map((w, i) => (
              <div key={i} className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bottle prep */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Tonight: Prep Your Bottles
          </h2>
          <div className="flex flex-col gap-2">
            {result.bottlePrep.map((bottle) => (
              <div key={bottle.bottleId} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sage-light flex items-center justify-center">
                      <Droplets className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Bottle {bottle.bottleIndex}</p>
                      <p className="text-xs text-muted-foreground">{bottle.mlCapacity}ml capacity</p>
                    </div>
                  </div>
                  {bottle.carbsTotal > 0 && (
                    <span className="text-sm font-bold text-primary">{bottle.carbsTotal}g</span>
                  )}
                </div>
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
              </div>
            ))}
          </div>
        </section>

        {/* Schedule */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              On the Bike
            </h2>
            {editMode && (
              <span className="text-xs text-primary font-medium bg-sage-light px-2 py-1 rounded-lg">
                Tap rows to edit food
              </span>
            )}
          </div>

          <div className={`bg-card border rounded-2xl overflow-hidden ${editMode ? "border-primary/40" : "border-border"}`}>
            {displaySchedule.map((item, i) => {
              const isLast = i === displaySchedule.length - 1;
              const pickerOpen = editMode && openPickerIdx === i;

              return (
                <div key={i} className={!isLast ? "border-b border-border" : ""}>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    {/* Time / km */}
                    <div className="shrink-0 w-16 text-right">
                      <p className="text-xs font-semibold text-foreground">{formatTime(item.timeMin)}</p>
                      <p className="text-xs text-muted-foreground">km {item.km}</p>
                    </div>

                    <div className="w-px bg-border self-stretch" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {item.note && (
                        <p className="text-sm text-muted-foreground">{item.note}</p>
                      )}
                      {item.drink && (
                        <div className="flex items-center gap-1.5">
                          <Droplets className="h-3.5 w-3.5 text-primary shrink-0" />
                          <p className="text-sm text-foreground">
                            <span className="font-medium">B{item.drink.bottleIndex}</span>{" "}
                            {item.drink.drinkName} — {item.drink.mlAmount}ml
                            {item.drink.carbs > 0 && (
                              <span className="text-muted-foreground"> ({item.drink.carbs}g)</span>
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
                      {editMode && (
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
                        </div>
                      )}
                    </div>

                    {/* Cumulative carbs */}
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-primary">{item.cumulativeCarbs}g</p>
                      <p className="text-xs text-muted-foreground">total</p>
                    </div>
                  </div>

                  {/* Food picker */}
                  {pickerOpen && (
                    <div className="px-4 pb-3 pt-0 border-t border-dashed border-border bg-muted/30">
                      <p className="text-xs text-muted-foreground font-medium mb-2 pt-2.5">
                        Select food:
                      </p>
                      {foods.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No foods in your list.{" "}
                          <button
                            onClick={() => router.push("/settings")}
                            className="text-primary underline"
                          >
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

        {/* Open minimal view */}
        <button
          onClick={() => window.open(`/plan/${plan.id}/minimal`, "_blank")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Open Minimal / Print View
        </button>

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

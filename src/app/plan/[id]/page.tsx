"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Sun, Cloud, CloudRain, CloudLightning,
  Snowflake, Wind, Droplets, Flame, AlertTriangle, Bike, Coffee,
  Edit2
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { formatDuration, formatTime } from "@/lib/utils";
import type { FuelPlan, WeatherData } from "@/lib/types";

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

export default function PlanResultPage() {
  const params = useParams();
  const router = useRouter();
  const { getPlan } = useStore();
  const [plan, setPlan] = useState<FuelPlan | null>(null);

  useEffect(() => {
    const found = getPlan(params.id as string);
    if (found) setPlan(found);
    else router.replace("/");
  }, [params.id, getPlan, router]);

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

  return (
    <div className="min-h-dvh bg-background pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
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
              onClick={() => router.push(`/plan/new?edit=${plan.id}`)}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
              title="Edit plan"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => window.open(`/plan/${plan.id}/minimal`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
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
              <p className="font-bold">{result.totalCarbs}g</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary-foreground/70 mb-0.5">
                <Droplets className="h-3.5 w-3.5" />
                <span className="text-xs">Fluid</span>
              </div>
              <p className="font-bold">{Math.round(result.totalFluidMl / 100) / 10}L</p>
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            On the Bike
          </h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {result.schedule.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3.5 ${
                  i < result.schedule.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="shrink-0 w-20 text-right">
                  <p className="text-xs font-semibold text-foreground">{formatTime(item.timeMin)}</p>
                  <p className="text-xs text-muted-foreground">km {item.km}</p>
                </div>
                <div className="w-px bg-border self-stretch" />
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
                  {item.food && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Bike className="h-3.5 w-3.5 text-accent shrink-0" />
                      <p className="text-sm text-foreground">
                        {item.food.name}{" "}
                        <span className="text-muted-foreground">({item.food.carbs}g)</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-primary">{item.cumulativeCarbs}g</p>
                  <p className="text-xs text-muted-foreground">total</p>
                </div>
              </div>
            ))}
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
      </div>
    </div>
  );
}

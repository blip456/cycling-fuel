"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Sun, Cloud, CloudRain, CloudLightning, Snowflake, Wind, Trash2, Leaf, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { formatDuration } from "@/lib/utils";
import type { WeatherData, FuelPlan } from "@/lib/types";

function WeatherIcon({ icon, className }: { icon: WeatherData["icon"]; className?: string }) {
  const props = { className: className ?? "h-4 w-4", strokeWidth: 1.5 };
  switch (icon) {
    case "sun": return <Sun {...props} />;
    case "rain": return <CloudRain {...props} />;
    case "storm": return <CloudLightning {...props} />;
    case "snow": return <Snowflake {...props} />;
    case "fog": return <Wind {...props} />;
    default: return <Cloud {...props} />;
  }
}

const DELETE_BTN_W = 88;

function SwipeToDeleteCard({ plan, onDelete }: { plan: FuelPlan; onDelete: () => void }) {
  const duration = plan.result?.durationHours ?? plan.distance / plan.avgSpeed;
  const [offsetX, setOffsetX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const dragging = useRef(false);
  const isOpen = offsetX <= -DELETE_BTN_W / 2;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    dragging.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!dragging.current && Math.abs(dx) < Math.abs(dy)) return; // vertical scroll wins
    if (Math.abs(dx) > 4) dragging.current = true;
    if (!dragging.current) return;
    e.stopPropagation();
    setOffsetX(Math.max(-DELETE_BTN_W, Math.min(0, dx + (isOpen ? -DELETE_BTN_W : 0))));
  }

  function onTouchEnd() {
    if (!dragging.current) return;
    setOffsetX(offsetX < -DELETE_BTN_W / 2 ? -DELETE_BTN_W : 0);
    dragging.current = false;
  }

  function handleCardClick(e: React.MouseEvent) {
    if (isOpen) { e.preventDefault(); setOffsetX(0); }
  }

  return (
    <div className="relative rounded-3xl overflow-hidden">
      {/* Delete action revealed behind the card */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive"
        style={{ width: DELETE_BTN_W }}
      >
        <button
          onClick={onDelete}
          aria-label={`Delete plan for ${format(parseISO(plan.rideDate), "MMM d")}`}
          className="flex flex-col items-center gap-1 text-destructive-foreground w-full h-full justify-center"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold tracking-wide">Delete</span>
        </button>
      </div>

      {/* Card — translates left on swipe */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragging.current ? "none" : "transform 0.4s cubic-bezier(0.16,1,0.3,1)",
          willChange: "transform",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Link
          href={`/plan/${plan.id}`}
          onClick={handleCardClick}
          className="block bg-card rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-500 ease-out overflow-hidden"
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-xl font-semibold text-foreground">
                    {format(parseISO(plan.rideDate), "MMMM d")}
                  </span>
                  {plan.weather && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <WeatherIcon icon={plan.weather.icon} className="h-3.5 w-3.5" />
                      {plan.weather.tempC}°C
                    </span>
                  )}
                  {plan.locked && (
                    <span
                      className="flex items-center gap-1 rounded-full bg-sage-light text-primary text-[11px] font-semibold px-2 py-0.5"
                      title="Locked — weather updates won't change this plan"
                    >
                      <Lock className="h-3 w-3" strokeWidth={2} />
                      Locked
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  <span>{plan.distance} km</span>
                  <span className="text-border">·</span>
                  <span>{formatDuration(duration)}</span>
                  <span className="text-border">·</span>
                  <span className="text-primary font-medium">{plan.carbsPerHour}g/hr</span>
                </div>
                {plan.location && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">{plan.location}</p>
                )}
              </div>
              <span className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-sage-light text-primary">
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </div>
          </div>
          {plan.result && (
            <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-sage-light text-primary text-xs font-medium px-3 py-1">
                {plan.result.totalCarbs}g carbs
              </span>
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs font-medium px-3 py-1">
                {Math.round(plan.result.totalFluidMl / 100) / 10}L fluid
              </span>
              {plan.feedback ? (
                <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs font-medium px-3 py-1">
                  ✓ logged
                </span>
              ) : (
                plan.rideDate <= format(new Date(), "yyyy-MM-dd") && (
                  <span className="inline-flex items-center rounded-full bg-peach-light text-accent text-xs font-semibold px-3 py-1">
                    Log how it went →
                  </span>
                )
              )}
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { plans, deletePlan } = useStore();
  const router = useRouter();

  const sortedPlans = [...plans].sort(
    (a, b) => new Date(b.rideDate).getTime() - new Date(a.rideDate).getTime()
  );

  return (
    <div className="px-5 pt-14 pb-nav">
      {/* Header */}
      <header className="mb-8 animate-fade-up">
        <p className="eyebrow text-sage">{getGreeting()}</p>
        <h1 className="font-display text-4xl font-semibold text-foreground mt-2 leading-tight">
          Ready to fuel<br />your <em className="text-primary">ride?</em>
        </h1>
      </header>

      {/* Primary CTA — an arch-topped invitation */}
      <button
        onClick={() => router.push("/plan/new")}
        className="group w-full text-left bg-primary text-primary-foreground rounded-3xl p-6 shadow-md hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-500 ease-out mb-10 relative overflow-hidden animate-fade-up"
        style={{ animationDelay: "80ms" }}
      >
        {/* Soft arch bloom in the corner */}
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary-foreground/5 blur-xl" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/10 mb-4">
              <Leaf className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <p className="eyebrow text-primary-foreground/70">New ride</p>
            <p className="font-display text-2xl font-semibold mt-1">Plan a new ride</p>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Distance, products &amp; your fuel schedule
            </p>
          </div>
          <span className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-primary-foreground/10 group-hover:bg-accent group-hover:translate-x-0.5 transition-all duration-300">
            <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
      </button>

      {sortedPlans.length > 0 ? (
        <section className="animate-fade-up" style={{ animationDelay: "160ms" }}>
          <h2 className="eyebrow text-muted-foreground mb-4">Recent rides</h2>
          <div className="flex flex-col gap-4">
            {sortedPlans.map((plan) => (
              <SwipeToDeleteCard
                key={plan.id}
                plan={plan}
                onDelete={() => deletePlan(plan.id)}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center py-16 animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-sage-light">
            <Leaf className="h-8 w-8 text-sage" strokeWidth={1.25} />
          </div>
          <p className="font-display text-xl text-foreground">No rides planned yet</p>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
            Plan your first ride and CycleFuel will craft a fueling schedule to match.
          </p>
        </div>
      )}
    </div>
  );
}

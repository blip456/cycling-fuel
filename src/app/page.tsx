"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Sun, Cloud, CloudRain, CloudLightning, Snowflake, Wind, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { formatDuration } from "@/lib/utils";
import type { WeatherData, FuelPlan } from "@/lib/types";

function WeatherIcon({ icon, className }: { icon: WeatherData["icon"]; className?: string }) {
  const props = { className: className ?? "h-4 w-4" };
  switch (icon) {
    case "sun": return <Sun {...props} />;
    case "rain": return <CloudRain {...props} />;
    case "storm": return <CloudLightning {...props} />;
    case "snow": return <Snowflake {...props} />;
    case "fog": return <Wind {...props} />;
    default: return <Cloud {...props} />;
  }
}

const DELETE_BTN_W = 80;

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
    <div className="relative rounded-2xl overflow-hidden">
      {/* Delete action revealed behind the card */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive"
        style={{ width: DELETE_BTN_W }}
      >
        <button
          onClick={onDelete}
          className="flex flex-col items-center gap-1 text-white w-full h-full justify-center"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px] font-semibold">Delete</span>
        </button>
      </div>

      {/* Card — translates left on swipe */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: dragging.current ? "none" : "transform 0.22s ease-out",
          willChange: "transform",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Link
          href={`/plan/${plan.id}`}
          onClick={handleCardClick}
          className="block bg-card rounded-2xl border border-border shadow-sm active:shadow-md overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-base">
                    {format(parseISO(plan.rideDate), "MMM d, yyyy")}
                  </span>
                  {plan.weather && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <WeatherIcon icon={plan.weather.icon} className="h-3.5 w-3.5" />
                      {plan.weather.tempC}°C
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  <span>{plan.distance} km</span>
                  <span className="text-border">·</span>
                  <span>{formatDuration(duration)}</span>
                  <span className="text-border">·</span>
                  <span className="text-primary font-medium">{plan.carbsPerHour}g carbs/hr</span>
                </div>
                {plan.location && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">{plan.location}</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          </div>
          {plan.result && (
            <div className="px-4 pb-3 flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-sage-light text-primary text-xs font-medium px-2.5 py-0.5">
                {plan.result.totalCarbs}g carbs
              </span>
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5">
                {Math.round(plan.result.totalFluidMl / 100) / 10}L fluid
              </span>
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
    <div className="px-4 pt-12 pb-nav">
      <div className="mb-6">
        {/* Brand lockup */}
        <div className="flex items-center gap-3 mb-5">
          <img
            src="/icons/icon.svg"
            alt="CycleFuel"
            className="h-11 w-11 rounded-2xl shadow-sm"
            aria-hidden="true"
          />
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-primary select-none">
            CycleFuel
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
        <h1 className="text-2xl font-bold text-foreground mt-0.5">
          Ready to fuel your ride?
        </h1>
      </div>

      <button
        onClick={() => router.push("/plan/new")}
        className="w-full flex items-center justify-between bg-primary text-primary-foreground rounded-2xl px-5 py-4 shadow-sm hover:bg-primary/90 active:scale-[0.99] transition-all duration-150 mb-8"
      >
        <div className="text-left">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span className="font-semibold text-base">Plan a New Ride</span>
          </div>
          <p className="text-primary-foreground/80 text-sm mt-0.5 ml-7">
            Set distance, products &amp; get your fuel schedule
          </p>
        </div>
        <ChevronRight className="h-5 w-5 opacity-70 shrink-0" />
      </button>

      {sortedPlans.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Recent Plans
          </h2>
          <div className="flex flex-col gap-3">
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
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🚴</div>
          <p className="text-muted-foreground text-sm">No plans yet.</p>
          <p className="text-muted-foreground text-sm">Tap &quot;Plan a New Ride&quot; to get started!</p>
        </div>
      )}
    </div>
  );
}

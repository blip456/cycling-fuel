"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { formatDuration, formatTime } from "@/lib/utils";
import type { FuelPlan } from "@/lib/types";

export default function MinimalPlanPage() {
  const params = useParams();
  const { getPlan } = useStore();
  const [plan, setPlan] = useState<FuelPlan | null>(null);

  useEffect(() => {
    const found = getPlan(params.id as string);
    if (found) setPlan(found);
  }, [params.id, getPlan]);

  if (!plan || !plan.result) {
    return (
      <div className="flex items-center justify-center min-h-screen font-mono text-sm text-gray-500">
        Plan not found.
      </div>
    );
  }

  const { result } = plan;

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-sm mx-auto font-mono text-sm print:p-0">
      <style>{`
        @media print {
          body { font-size: 12px; }
          .no-print { display: none !important; }
          @page { margin: 1cm; }
        }
      `}</style>

      <button
        onClick={() => window.print()}
        className="no-print mb-6 px-4 py-2 border border-gray-300 rounded text-xs hover:bg-gray-50 transition-colors"
      >
        Print / Save as PDF
      </button>

      {/* Title */}
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-tight uppercase">Fuel Plan</h1>
        <p className="text-gray-500 mt-0.5">
          {format(parseISO(plan.rideDate), "EEE d MMM yyyy")}
          {" · "}{plan.distance}km
          {" · "}{formatDuration(result.durationHours)}
        </p>
        {plan.location && <p className="text-gray-400 text-xs mt-0.5">{plan.location}</p>}
        {plan.weather && (
          <p className="text-gray-500 text-xs mt-0.5">
            {plan.weather.tempC}°C · {plan.weather.description}
          </p>
        )}
      </div>

      <hr className="border-gray-200 mb-4" />

      {/* Targets */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1.5">Targets</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border border-gray-100 rounded p-2">
            <p className="font-bold text-base">{plan.carbsPerHour}g</p>
            <p className="text-xs text-gray-400">carbs/hr</p>
          </div>
          <div className="border border-gray-100 rounded p-2">
            <p className="font-bold text-base">{result.totalCarbs}g</p>
            <p className="text-xs text-gray-400">total carbs</p>
          </div>
          <div className="border border-gray-100 rounded p-2">
            <p className="font-bold text-base">{Math.round(result.totalFluidMl / 100) / 10}L</p>
            <p className="text-xs text-gray-400">fluid</p>
          </div>
        </div>
      </div>

      <hr className="border-gray-200 mb-4" />

      {/* Bottle prep */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1.5">
          Bottles (prep tonight)
        </p>
        {result.bottlePrep.map((bottle) => (
          <div key={bottle.bottleId} className="flex items-baseline gap-2 mb-1">
            <span className="font-bold min-w-[22px]">B{bottle.bottleIndex}</span>
            <span className="flex-1">
              {bottle.drinkName}
              {bottle.scoops > 0
                ? ` — ${bottle.scoops} sc / ${bottle.waterMl}ml water`
                : ` — ${bottle.waterMl}ml water`}
            </span>
            {bottle.carbsTotal > 0 && (
              <span className="text-gray-500">{bottle.carbsTotal}g</span>
            )}
          </div>
        ))}
      </div>

      <hr className="border-gray-200 mb-4" />

      {/* Pre-ride */}
      {result.preRideNote && (
        <>
          <div className="mb-4">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-1.5">Pre-ride</p>
            <p className="text-gray-700">{result.preRideNote}</p>
          </div>
          <hr className="border-gray-200 mb-4" />
        </>
      )}

      {/* Schedule */}
      <div>
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-1.5">Schedule</p>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="pb-1 pr-3 font-normal">Time</th>
              <th className="pb-1 pr-3 font-normal">KM</th>
              <th className="pb-1 font-normal">Action</th>
              <th className="pb-1 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.schedule.map((item, i) => {
              const actions: string[] = [];
              if (item.note) actions.push(item.note);
              if (item.drink) {
                const drinkLabel = item.drink.drinkName === "Water"
                  ? `Drink B${item.drink.bottleIndex} (${item.drink.mlAmount}ml)`
                  : `B${item.drink.bottleIndex} ${item.drink.drinkName} (${item.drink.mlAmount}ml)`;
                actions.push(drinkLabel);
              }
              if (item.food) {
                actions.push(item.food.name);
              }
              return (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{formatTime(item.timeMin)}</td>
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{item.km}</td>
                  <td className="py-1.5 pr-3">{actions.join(" + ")}</td>
                  <td className="py-1.5 text-right font-medium whitespace-nowrap">{item.cumulativeCarbs}g</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <hr className="border-gray-200 mt-4 mb-3" />
      <p className="text-xs text-gray-400 text-center">
        CycleFuel · {plan.distance}km · {formatDuration(result.durationHours)} · {plan.carbsPerHour}g/hr
      </p>
    </div>
  );
}

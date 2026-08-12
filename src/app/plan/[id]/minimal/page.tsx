"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toPng } from "html-to-image";
import { useStore } from "@/lib/store";
import { formatDuration, formatTime } from "@/lib/utils";
import { planCarbBalance } from "@/lib/carb-balance";
import type { FuelPlan } from "@/lib/types";

export default function MinimalPlanPage() {
  const params = useParams();
  const { getPlan } = useStore();
  const [plan, setPlan] = useState<FuelPlan | null>(null);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const found = getPlan(params.id as string);
    if (found) setPlan(found);
  }, [params.id, getPlan]);

  async function downloadPng() {
    if (!contentRef.current || !plan) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(contentRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `fuel-plan-${plan.rideDate}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  function downloadPdf() {
    const style = document.createElement("style");
    style.innerHTML = `@media print { .no-print { display: none !important; } @page { margin: 1cm; size: A4; } }`;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  }

  function printPage() {
    window.print();
  }

  if (!plan || !plan.result) {
    return (
      <div className="flex items-center justify-center min-h-screen font-mono text-sm text-gray-500">
        Plan not found.
      </div>
    );
  }

  const { result } = plan;
  // Bottles count in full here too — a carried bottle is a finished bottle.
  const balance = planCarbBalance(plan, result);
  const carriedMl = result.bottlePrep.reduce((sum, b) => sum + b.mlCapacity, 0);

  return (
    <div className="bg-white min-h-screen">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          @page { margin: 1cm; }
        }
      `}</style>

      {/* Action bar — hidden on print/export */}
      <div className="no-print sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 z-10">
        <span className="text-xs font-medium text-gray-500 mr-auto">Export plan</span>
        <button
          onClick={downloadPng}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {exporting ? "…" : "⬇ PNG"}
        </button>
        <button
          onClick={downloadPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          📄 PDF
        </button>
        <button
          onClick={printPage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
        >
          🖨 Print
        </button>
      </div>

      {/* Plan content */}
      <div ref={contentRef} className="p-6 max-w-sm mx-auto font-mono text-sm text-black">
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
              <p className="font-bold text-base">{balance.plannedCarbs}g</p>
              <p className="text-xs text-gray-400">total carbs</p>
            </div>
            <div className="border border-gray-100 rounded p-2">
              <p className="font-bold text-base">{(result.totalFluidMl / 1000).toFixed(1)}L</p>
              <p className="text-xs text-gray-400">fluid</p>
            </div>
          </div>
          {carriedMl > result.totalFluidMl + 100 && (
            <p className="text-xs text-gray-500 mt-2">
              Fluid: {(carriedMl / 1000).toFixed(1)}L in bottles, all of it finished, vs{" "}
              {(result.totalFluidMl / 1000).toFixed(1)}L this ride needs.
            </p>
          )}
          {balance.overshoot && (
            <p className="text-xs text-gray-700 mt-2 font-bold">
              ⚠ {balance.diffG}g over target: {balance.plannedCarbs}g planned vs {balance.targetCarbs}g needed
              ({balance.plannedPerHour}g/hr vs {balance.targetPerHour}g/hr). Every bottle counted as finished.
              {plan.carbOvershootAccepted ? " Accepted by you." : " Mix weaker or bring smaller bottles."}
            </p>
          )}
          {(result.sodiumTargetMg ?? 0) > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Sodium: ~{result.sodiumDeliveredMg}mg planned / ~{result.sodiumTargetMg}mg lost in sweat
              {(result.sodiumDeliveredMg ?? 0) < (result.sodiumTargetMg ?? 0) * 0.5 ? " — add electrolytes" : ""}
            </p>
          )}
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
        {(result.preRideNote || result.caffeineNote) && (
          <>
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1.5">Pre-ride</p>
              {result.preRideNote && <p className="text-gray-700">{result.preRideNote}</p>}
              {result.caffeineNote && <p className="text-gray-700 mt-1.5">{result.caffeineNote}</p>}
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
                  const sips = item.drink.sips ?? Math.round(item.drink.mlAmount / 50);
                  const drinkLabel = item.drink.drinkName === "Water"
                    ? `B${item.drink.bottleIndex} water (${sips} sip${sips !== 1 ? "s" : ""})`
                    : `B${item.drink.bottleIndex} ${item.drink.drinkName} (${sips} sip${sips !== 1 ? "s" : ""})`;
                  actions.push(drinkLabel);
                  if (item.drink.bottleFinished) actions.push("→ next bottle");
                }
                if (item.food) actions.push(item.food.name);
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

        {result.recoveryNote && (
          <>
            <hr className="border-gray-200 my-4" />
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1.5">Recovery</p>
              <p className="text-gray-700">{result.recoveryNote}</p>
            </div>
          </>
        )}

        <hr className="border-gray-200 mt-4 mb-3" />
        <p className="text-xs text-gray-400 text-center">
          CycleFuel · {plan.distance}km · {formatDuration(result.durationHours)} · {plan.carbsPerHour}g/hr
        </p>
      </div>
    </div>
  );
}

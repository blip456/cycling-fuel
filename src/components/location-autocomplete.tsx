"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchLocations, formatGeoLabel, type GeoResult } from "@/lib/weather";

export interface VerifiedLocation {
  label: string;
  lat: number;
  lng: number;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 2;

export function LocationAutocomplete({
  id,
  value,
  verified,
  placeholder,
  onTextChange,
  onSelect,
}: {
  id?: string;
  value: string;
  /** The currently verified location, or null when the text is free-form */
  verified: VerifiedLocation | null;
  placeholder?: string;
  /** Fired on keystrokes — parent should clear `verified` if the text no longer matches */
  onTextChange: (text: string) => void;
  /** Fired when the user picks a suggestion */
  onSelect: (loc: VerifiedLocation) => void;
}) {
  // Suggestions are tagged with the query they answer, so loading and
  // no-results states derive from (value, result) without effect-time setState.
  const [result, setResult] = useState<{ query: string; items: GeoResult[] } | null>(null);
  const [open, setOpen] = useState(true);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const query = value.trim();
  const isVerified = !!verified && verified.label === value;
  const active = !isVerified && query.length >= MIN_QUERY_LEN;
  const current = active && result?.query === query ? result : null;
  const loading = active && !current;
  const noResults = !!current && current.items.length === 0;
  const suggestions = current?.items ?? [];

  // Debounced suggestion fetch as the user types
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const items = await searchLocations(query, 5, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResult({ query, items });
      setHighlight(-1);
      setOpen(true);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, active]);

  // Close the dropdown when tapping outside
  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  function select(g: GeoResult) {
    onSelect({ label: formatGeoLabel(g), lat: g.latitude, lng: g.longitude });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(suggestions[Math.max(0, highlight)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = active && open && (suggestions.length > 0 || noResults);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onTextChange(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="pr-9"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : isVerified ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </div>

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
        >
          {suggestions.map((g, i) => (
            <li key={g.id ?? `${g.latitude},${g.longitude}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onClick={() => select(g)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors ${
                  i === highlight ? "bg-sage-light" : "bg-card"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">{g.name}</span>
                  {(g.admin1 || g.country) && (
                    <span className="block text-xs text-muted-foreground truncate">
                      {[g.admin1, g.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {noResults && (
            <li className="px-3.5 py-2.5 text-sm text-muted-foreground">
              No matching place found — check the spelling.
            </li>
          )}
        </ul>
      )}

      {/* Verification status */}
      {isVerified ? (
        <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Location verified — weather will use this exact spot.
        </p>
      ) : active && !loading ? (
        <p className="text-xs text-muted-foreground mt-1.5">
          Pick a suggestion to verify the location.
        </p>
      ) : null}
    </div>
  );
}

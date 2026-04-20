"use client";

import { useState, useRef } from "react";
import { Plus, Minus, Pencil, Trash2, Check, Download, Upload, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { DrinkProduct, FoodItem, FuelPlan, UserProfile, CarbRatio } from "@/lib/types";

const CARB_RATIO_LABELS: Record<CarbRatio, string> = {
  "single": "Single source (glucose only)",
  "2:1": "2:1 (glucose : fructose)",
  "1:1": "1:1 (glucose : fructose)",
};

const EMPTY_DRINK: Omit<DrinkProduct, "id"> = {
  name: "",
  brand: "",
  flavour: "",
  scoopsRecommended: 2,
  mlPerServing: 500,
  carbsPerServing: 30,
  carbRatio: "2:1",
};

const EMPTY_FOOD: Omit<FoodItem, "id"> = {
  name: "",
  brand: "",
  flavour: "",
  carbsPerServing: 25,
};

function NumberStepper({
  label,
  value,
  unit,
  min = 1,
  max = 9999,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  const [inputStr, setInputStr] = useState(String(value));

  function step(delta: number) {
    const base = parseInt(inputStr);
    const next = Math.min(max, Math.max(min, (isNaN(base) ? value : base) + delta));
    setInputStr(String(next));
    onChange(next);
  }

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground hover:bg-border transition-colors shrink-0"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 relative min-w-0">
          <Input
            type="text"
            inputMode="numeric"
            value={inputStr}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setInputStr(raw);
              const v = parseInt(raw);
              if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
            onBlur={() => {
              const v = parseInt(inputStr);
              const clamped = isNaN(v) ? min : Math.min(max, Math.max(min, v));
              setInputStr(String(clamped));
              onChange(clamped);
            }}
            className="text-center pr-9"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground hover:bg-border transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DrinkModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Partial<DrinkProduct>;
  onClose: () => void;
  onSave: (d: Omit<DrinkProduct, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<DrinkProduct, "id">>({
    ...EMPTY_DRINK,
    ...initial,
  });

  function f<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const isValid = form.name.trim().length > 0 && form.carbsPerServing > 0 && form.mlPerServing > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Drink" : "Add Drink"}</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-2 block">Name *</Label>
              <Input
                placeholder="Isotonic Mix"
                value={form.name}
                onChange={(e) => f("name", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-2 block">Brand</Label>
              <Input
                placeholder="Etixx"
                value={form.brand}
                onChange={(e) => f("brand", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Flavour (optional)</Label>
            <Input
              placeholder="Citrus, Berry, …"
              value={form.flavour ?? ""}
              onChange={(e) => f("flavour", e.target.value)}
            />
          </div>

          <NumberStepper
            label="Scoops (recommended)"
            value={form.scoopsRecommended}
            unit="sc"
            min={1}
            max={10}
            onChange={(v) => f("scoopsRecommended", v)}
          />

          <NumberStepper
            label="Water per serving"
            value={form.mlPerServing}
            unit="ml"
            min={100}
            max={2000}
            onChange={(v) => f("mlPerServing", v)}
          />
          <NumberStepper
            label="Carbs per serving"
            value={form.carbsPerServing}
            unit="g"
            min={1}
            max={200}
            onChange={(v) => f("carbsPerServing", v)}
          />

          <div>
            <Label className="mb-2 block">Carb Ratio</Label>
            <Select value={form.carbRatio} onValueChange={(v) => f("carbRatio", v as CarbRatio)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CARB_RATIO_LABELS) as [CarbRatio, string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              {form.carbRatio === "single"
                ? "Max ~60g/hr absorption."
                : form.carbRatio === "2:1"
                ? "Recommended for 90g/hr. Uses dual transport pathways."
                : "Best for 120g/hr+ with gut training."}
            </p>
          </div>

          <Button
            className="w-full mt-1"
            disabled={!isValid}
            onClick={() => { if (isValid) onSave(form); }}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Save Drink
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FoodModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Partial<FoodItem>;
  onClose: () => void;
  onSave: (f: Omit<FoodItem, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<FoodItem, "id">>({
    ...EMPTY_FOOD,
    ...initial,
  });

  function f<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const isValid = form.name.trim().length > 0 && form.carbsPerServing > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Food" : "Add Food"}</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-2 block">Name *</Label>
              <Input
                placeholder="Energy Bar"
                value={form.name}
                onChange={(e) => f("name", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-2 block">Brand</Label>
              <Input
                placeholder="Sponser"
                value={form.brand ?? ""}
                onChange={(e) => f("brand", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Flavour (optional)</Label>
            <Input
              placeholder="Chocolate, Vanilla, …"
              value={form.flavour ?? ""}
              onChange={(e) => f("flavour", e.target.value)}
            />
          </div>

          <NumberStepper
            label="Carbs per serving"
            value={form.carbsPerServing}
            unit="g"
            min={1}
            max={200}
            onChange={(v) => f("carbsPerServing", v)}
          />

          <Button
            className="w-full mt-1"
            disabled={!isValid}
            onClick={() => { if (isValid) onSave(form); }}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Save Food
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ImportMode = "merge" | "replace";

interface ImportPayload {
  profile?: UserProfile;
  drinks?: DrinkProduct[];
  foods?: FoodItem[];
  plans?: FuelPlan[];
}

function ImportModal({
  open,
  payload,
  onClose,
  onImport,
}: {
  open: boolean;
  payload: ImportPayload;
  onClose: () => void;
  onImport: (
    selected: { profile: boolean; drinks: boolean; foods: boolean; plans: boolean },
    modes: { drinks: ImportMode; foods: ImportMode; plans: ImportMode }
  ) => void;
}) {
  const [sel, setSel] = useState({ profile: true, drinks: true, foods: true, plans: true });
  const [modes, setModes] = useState<{ drinks: ImportMode; foods: ImportMode; plans: ImportMode }>({
    drinks: "merge",
    foods: "merge",
    plans: "merge",
  });

  const hasProfile = !!payload.profile;
  const drinkCount = payload.drinks?.length ?? 0;
  const foodCount = payload.foods?.length ?? 0;
  const planCount = payload.plans?.length ?? 0;

  const nothingSelected = !sel.profile && !sel.drinks && !sel.foods && !sel.plans;

  function toggle(k: keyof typeof sel) {
    setSel((p) => ({ ...p, [k]: !p[k] }));
  }

  function setMode(k: keyof typeof modes, v: ImportMode) {
    setModes((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-6 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Choose what to import and how to handle conflicts.</p>

          <div className="flex flex-col gap-3">
            {/* Profile */}
            {hasProfile && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sel.profile}
                  onChange={() => toggle("profile")}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm font-medium flex-1">Profile &amp; defaults</span>
              </label>
            )}

            {/* Drinks */}
            {drinkCount > 0 && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sel.drinks}
                    onChange={() => toggle("drinks")}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium flex-1">Drinks <span className="text-muted-foreground font-normal">({drinkCount} items)</span></span>
                </label>
                {sel.drinks && (
                  <div className="ml-7 flex gap-3">
                    {(["merge", "replace"] as ImportMode[]).map((m) => (
                      <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                        <input
                          type="radio"
                          checked={modes.drinks === m}
                          onChange={() => setMode("drinks", m)}
                          className="accent-primary"
                        />
                        {m === "merge" ? "Add new only" : "Replace all"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Foods */}
            {foodCount > 0 && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sel.foods}
                    onChange={() => toggle("foods")}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium flex-1">Foods <span className="text-muted-foreground font-normal">({foodCount} items)</span></span>
                </label>
                {sel.foods && (
                  <div className="ml-7 flex gap-3">
                    {(["merge", "replace"] as ImportMode[]).map((m) => (
                      <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                        <input
                          type="radio"
                          checked={modes.foods === m}
                          onChange={() => setMode("foods", m)}
                          className="accent-primary"
                        />
                        {m === "merge" ? "Add new only" : "Replace all"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Plans */}
            {planCount > 0 && (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sel.plans}
                    onChange={() => toggle("plans")}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium flex-1">Ride plans <span className="text-muted-foreground font-normal">({planCount} items)</span></span>
                </label>
                {sel.plans && (
                  <div className="ml-7 flex gap-3">
                    {(["merge", "replace"] as ImportMode[]).map((m) => (
                      <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                        <input
                          type="radio"
                          checked={modes.plans === m}
                          onChange={() => setMode("plans", m)}
                          className="accent-primary"
                        />
                        {m === "merge" ? "Add new only" : "Replace all"}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            className="w-full mt-1"
            disabled={nothingSelected}
            onClick={() => onImport(sel, modes)}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Import Selected
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CARB_HOUR_OPTIONS = [45, 60, 90, 120] as const;
const BOTTLE_SIZE_OPTIONS = [500, 750, 1000] as const;

export default function SettingsPage() {
  const {
    profile, drinks, foods, plans,
    updateProfile, addDrink, updateDrink, deleteDrink,
    addFood, updateFood, deleteFood,
    importData, clearAll,
  } = useStore();

  const [drinkModal, setDrinkModal] = useState<{ open: boolean; drink?: DrinkProduct }>({ open: false });
  const [foodModal, setFoodModal] = useState<{ open: boolean; food?: FoodItem }>({ open: false });
  const [importModal, setImportModal] = useState<{ open: boolean; payload: ImportPayload }>({ open: false, payload: {} });
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = JSON.stringify({ profile, drinks, foods, plans }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cyclefuel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as ImportPayload;
        if (typeof parsed !== "object" || parsed === null) throw new Error();
        setImportModal({ open: true, payload: parsed });
      } catch {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
  }

  function handleImport(
    sel: { profile: boolean; drinks: boolean; foods: boolean; plans: boolean },
    modes: { drinks: ImportMode; foods: ImportMode; plans: ImportMode }
  ) {
    importData({
      ...(sel.profile && importModal.payload.profile ? { profile: importModal.payload.profile } : {}),
      ...(sel.drinks && importModal.payload.drinks ? { drinks: importModal.payload.drinks } : {}),
      ...(sel.foods && importModal.payload.foods ? { foods: importModal.payload.foods } : {}),
      ...(sel.plans && importModal.payload.plans ? { plans: importModal.payload.plans } : {}),
      modes,
    });
    setImportModal({ open: false, payload: {} });
  }

  return (
    <div className="px-4 pt-12 pb-nav">
      {/* Brand lockup */}
      <div className="flex items-center gap-3 mb-5">
        <img src="/icons/icon.svg" alt="CycleFuel" className="h-11 w-11 rounded-2xl shadow-sm" aria-hidden="true" />
        <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-primary select-none">CycleFuel</span>
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Profile */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Your Profile
        </h2>
        <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-4">
          <div>
            <Label className="mb-2 block">Body Weight (for pre-ride carb tips)</Label>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="70"
                value={profile.weightKg ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  updateProfile({ weightKg: isNaN(v) ? undefined : v });
                }}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Default Carbs per Hour</Label>
            <div className="grid grid-cols-4 gap-2">
              {CARB_HOUR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => updateProfile({ defaultCarbsPerHour: opt })}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150 ${
                    profile.defaultCarbsPerHour === opt
                      ? "bg-primary text-white border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {opt}g
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Default Bottle Size</Label>
            <div className="grid grid-cols-3 gap-2">
              {BOTTLE_SIZE_OPTIONS.map((ml) => (
                <button
                  key={ml}
                  onClick={() => updateProfile({ defaultBottleMl: ml })}
                  className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150 ${
                    profile.defaultBottleMl === ml
                      ? "bg-primary text-white border-primary"
                      : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {ml}ml
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Drinks */}
      <section className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            My Drinks
          </h2>
          <button
            onClick={() => setDrinkModal({ open: true })}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Drink
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {drinks.map((drink) => (
            <div key={drink.id} className="bg-card rounded-2xl border border-border px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm truncate">{drink.name}</p>
                  {drink.brand && (
                    <p className="text-xs text-muted-foreground">{drink.brand}{drink.flavour ? ` · ${drink.flavour}` : ""}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {drink.scoopsRecommended} scoops / {drink.mlPerServing}ml · {drink.carbsPerServing}g carbs · {drink.carbRatio}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setDrinkModal({ open: true, drink })}
                    className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${drink.name}"?`)) deleteDrink(drink.id);
                    }}
                    className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {drinks.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground bg-card rounded-2xl border border-border border-dashed">
              No drinks yet. Add your powder mixes and isotonic drinks.
            </div>
          )}
        </div>
      </section>

      {/* Foods */}
      <section className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            My Foods
          </h2>
          <button
            onClick={() => setFoodModal({ open: true })}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Food
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {foods.map((food) => (
            <div key={food.id} className="bg-card rounded-2xl border border-border px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm">{food.name}</p>
                  {(food.brand || food.flavour) && (
                    <p className="text-xs text-muted-foreground">
                      {food.brand}{food.brand && food.flavour ? ` · ${food.flavour}` : food.flavour}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-primary">{food.carbsPerServing}g</span>
                  <button
                    onClick={() => setFoodModal({ open: true, food })}
                    className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${food.name}"?`)) deleteFood(food.id);
                    }}
                    className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {foods.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground bg-card rounded-2xl border border-border border-dashed">
              No foods yet. Add bars, gels, bananas and other snacks.
            </div>
          )}
        </div>
      </section>

      {/* Help */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Help
        </h2>
        <a
          href="/help"
          className="flex items-center justify-between bg-card rounded-2xl border border-border px-4 py-3.5 hover:bg-muted transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-foreground">How CycleFuel works</p>
            <p className="text-xs text-muted-foreground mt-0.5">Science, formulas &amp; feature guide</p>
          </div>
          <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </a>
      </section>

      {/* Data Management */}
      <section className="mb-7">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Data
        </h2>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-card border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4 text-primary" />
            Export JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-card border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="h-4 w-4 text-primary" />
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Clear all */}
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            Clear All Data
          </button>
        ) : (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-destructive text-center">
              This resets everything to factory defaults. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { clearAll(); setClearConfirm(false); }}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Drink Modal */}
      <DrinkModal
        key={drinkModal.drink?.id ?? "new-drink"}
        open={drinkModal.open}
        initial={drinkModal.drink}
        onClose={() => setDrinkModal({ open: false })}
        onSave={(form) => {
          if (drinkModal.drink) {
            updateDrink(drinkModal.drink.id, form);
          } else {
            addDrink(form);
          }
          setDrinkModal({ open: false });
        }}
      />

      {/* Food Modal */}
      <FoodModal
        key={foodModal.food?.id ?? "new-food"}
        open={foodModal.open}
        initial={foodModal.food}
        onClose={() => setFoodModal({ open: false })}
        onSave={(form) => {
          if (foodModal.food) {
            updateFood(foodModal.food.id, form);
          } else {
            addFood(form);
          }
          setFoodModal({ open: false });
        }}
      />

      {/* Import Modal */}
      <ImportModal
        key={importModal.open ? "open" : "closed"}
        open={importModal.open}
        payload={importModal.payload}
        onClose={() => setImportModal({ open: false, payload: {} })}
        onImport={handleImport}
      />

      {/* Version footer */}
      {(() => {
        const deployId =
          process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ??
          process.env.NEXT_PUBLIC_BUILD_ID ??
          "dev";
        return (
          <div className="text-center pt-2 pb-4">
            <p className="text-sm text-muted-foreground">
              {new Date(process.env.NEXT_PUBLIC_BUILD_DATE ?? Date.now()).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"} · {deployId}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

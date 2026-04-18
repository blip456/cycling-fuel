"use client";

import { useState } from "react";
import { Plus, Minus, Pencil, Trash2, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { DrinkProduct, FoodItem, CarbRatio } from "@/lib/types";

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

const CARB_HOUR_OPTIONS = [45, 60, 90, 120] as const;
const BOTTLE_SIZE_OPTIONS = [500, 750, 1000] as const;

export default function SettingsPage() {
  const { profile, drinks, foods, updateProfile, addDrink, updateDrink, deleteDrink, addFood, updateFood, deleteFood } = useStore();

  const [drinkModal, setDrinkModal] = useState<{ open: boolean; drink?: DrinkProduct }>({ open: false });
  const [foodModal, setFoodModal] = useState<{ open: boolean; food?: FoodItem }>({ open: false });

  return (
    <div className="px-4 pt-12 pb-nav">
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
    </div>
  );
}

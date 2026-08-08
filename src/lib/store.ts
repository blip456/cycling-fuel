"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DrinkProduct, FoodItem, FuelPlan, SweatTest, UserProfile } from "./types";
import { generateId } from "./utils";

const DEFAULT_DRINKS: DrinkProduct[] = [
  {
    id: "etixx-isotonic",
    name: "Etixx Isotonic",
    brand: "Etixx",
    flavour: "Citrus",
    scoopsRecommended: 2,
    mlPerServing: 500,
    carbsPerServing: 30,
    carbRatio: "1:1",
    sodiumMgPerServing: 250,
  },
];

const DEFAULT_FOODS: FoodItem[] = [
  { id: "banana", name: "Banana (medium)", carbsPerServing: 25, type: "real", sodiumMg: 1 },
  { id: "energy-bar", name: "Energy Bar", brand: "Generic", carbsPerServing: 40, type: "bar", sodiumMg: 60 },
];

interface AppStore {
  profile: UserProfile;
  drinks: DrinkProduct[];
  foods: FoodItem[];
  plans: FuelPlan[];

  updateProfile: (update: Partial<UserProfile>) => void;
  addSweatTest: (test: SweatTest) => void;

  addDrink: (drink: Omit<DrinkProduct, "id">) => void;
  updateDrink: (id: string, update: Partial<DrinkProduct>) => void;
  deleteDrink: (id: string) => void;

  addFood: (food: Omit<FoodItem, "id">) => void;
  updateFood: (id: string, update: Partial<FoodItem>) => void;
  deleteFood: (id: string) => void;

  savePlan: (plan: FuelPlan) => void;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => FuelPlan | undefined;

  importData: (payload: {
    profile?: UserProfile;
    drinks?: DrinkProduct[];
    foods?: FoodItem[];
    plans?: FuelPlan[];
    modes: { drinks: "merge" | "replace"; foods: "merge" | "replace"; plans: "merge" | "replace" };
  }) => void;
  clearAll: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      profile: {
        defaultCarbsPerHour: 60,
        defaultBottleMl: 500,
        defaultIntensity: "steady",
      },
      drinks: DEFAULT_DRINKS,
      foods: DEFAULT_FOODS,
      plans: [],

      updateProfile: (update) =>
        set((s) => ({ profile: { ...s.profile, ...update } })),

      addSweatTest: (test) =>
        set((s) => ({
          profile: {
            ...s.profile,
            sweatRateMlPerHour: test.sweatRateMlPerHour,
            sweatTests: [test, ...(s.profile.sweatTests ?? [])].slice(0, 20),
          },
        })),

      addDrink: (drink) =>
        set((s) => ({ drinks: [...s.drinks, { ...drink, id: generateId() }] })),
      updateDrink: (id, update) =>
        set((s) => ({
          drinks: s.drinks.map((d) => (d.id === id ? { ...d, ...update } : d)),
        })),
      deleteDrink: (id) =>
        set((s) => ({ drinks: s.drinks.filter((d) => d.id !== id) })),

      addFood: (food) =>
        set((s) => ({ foods: [...s.foods, { ...food, id: generateId() }] })),
      updateFood: (id, update) =>
        set((s) => ({
          foods: s.foods.map((f) => (f.id === id ? { ...f, ...update } : f)),
        })),
      deleteFood: (id) =>
        set((s) => ({ foods: s.foods.filter((f) => f.id !== id) })),

      savePlan: (plan) =>
        set((s) => {
          const existing = s.plans.findIndex((p) => p.id === plan.id);
          if (existing >= 0) {
            const updated = [...s.plans];
            updated[existing] = plan;
            return { plans: updated };
          }
          return { plans: [plan, ...s.plans] };
        }),
      deletePlan: (id) =>
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      getPlan: (id) => get().plans.find((p) => p.id === id),

      importData: ({ profile, drinks, foods, plans, modes }) =>
        set((s) => {
          function merge<T extends { id: string }>(existing: T[], incoming: T[], mode: "merge" | "replace"): T[] {
            if (mode === "replace") return incoming;
            const ids = new Set(existing.map((x) => x.id));
            return [...existing, ...incoming.filter((x) => !ids.has(x.id))];
          }
          return {
            // Older backups predate defaultIntensity — backfill it
            ...(profile
              ? { profile: { ...profile, defaultIntensity: profile.defaultIntensity ?? "steady" } }
              : {}),
            ...(drinks ? { drinks: merge(s.drinks, drinks, modes.drinks) } : {}),
            ...(foods ? { foods: merge(s.foods, foods, modes.foods) } : {}),
            // Backups predating forecast refresh have no calcWeather — pin it
            // to the plan's own forecast so they don't import as "out of date"
            ...(plans
              ? {
                  plans: merge(
                    s.plans,
                    plans.map((p) => {
                      const prep = p.result?.bottlePrep;
                      const bottles =
                        prep && prep.length !== p.bottles.length
                          ? prep.map((b) => ({ id: b.bottleId, mlCapacity: b.mlCapacity }))
                          : p.bottles;
                      return {
                        ...p,
                        calcWeather: p.calcWeather ?? p.weather,
                        bottles,
                        bottlesCarried: p.bottlesCarried ?? p.bottles.length,
                      };
                    }),
                    modes.plans
                  ),
                }
              : {}),
          };
        }),

      clearAll: () =>
        set({ profile: { defaultCarbsPerHour: 60, defaultBottleMl: 500, defaultIntensity: "steady" }, drinks: DEFAULT_DRINKS, foods: DEFAULT_FOODS, plans: [] }),
    }),
    {
      name: "cycling-fuel-store",
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as Partial<AppStore>;
        if (version < 1 && state.profile) {
          // Existing users keep their carb default; intensity is new
          state.profile.defaultIntensity ??= "steady";
        }
        if (version < 2) {
          // v2 adds electrolytes, food types and sweat-rate tracking.
          // Backfill conservative defaults so existing data keeps working.
          state.foods?.forEach((f) => {
            if (!f.type) f.type = "bar";
          });
        }
        if (version < 3) {
          // v3 adds forecast refresh + plan locking. Existing plans were
          // calculated from the forecast they already carry, so pin
          // calcWeather to it — otherwise every old plan would open with a
          // spurious "forecast changed" banner.
          state.plans?.forEach((p) => {
            p.calcWeather ??= p.weather;
          });
        }
        if (version < 4) {
          // v4: a bottle rhythm used to invent its extra fills inside the
          // calculator, so a plan could show 6 bottles to prep while its own
          // bottle list still held 2 — and editing it snapped back to 2.
          // The prep list is the truthful one; adopt it, and remember how many
          // bottles the rider actually carries.
          state.plans?.forEach((p) => {
            const prep = p.result?.bottlePrep;
            if (prep && prep.length !== p.bottles.length) {
              p.bottlesCarried ??= p.bottles.length;
              p.bottles = prep.map((b) => ({ id: b.bottleId, mlCapacity: b.mlCapacity }));
            }
          });
        }
        return state as AppStore;
      },
    }
  )
);

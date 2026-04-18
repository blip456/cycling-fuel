"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DrinkProduct, FoodItem, FuelPlan, UserProfile } from "./types";
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
  },
];

const DEFAULT_FOODS: FoodItem[] = [
  { id: "banana", name: "Banana (medium)", carbsPerServing: 25 },
  { id: "energy-bar", name: "Energy Bar", brand: "Generic", carbsPerServing: 40 },
];

interface AppStore {
  profile: UserProfile;
  drinks: DrinkProduct[];
  foods: FoodItem[];
  plans: FuelPlan[];

  updateProfile: (update: Partial<UserProfile>) => void;

  addDrink: (drink: Omit<DrinkProduct, "id">) => void;
  updateDrink: (id: string, update: Partial<DrinkProduct>) => void;
  deleteDrink: (id: string) => void;

  addFood: (food: Omit<FoodItem, "id">) => void;
  updateFood: (id: string, update: Partial<FoodItem>) => void;
  deleteFood: (id: string) => void;

  savePlan: (plan: FuelPlan) => void;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => FuelPlan | undefined;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      profile: {
        defaultCarbsPerHour: 90,
        defaultBottleMl: 500,
      },
      drinks: DEFAULT_DRINKS,
      foods: DEFAULT_FOODS,
      plans: [],

      updateProfile: (update) =>
        set((s) => ({ profile: { ...s.profile, ...update } })),

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
    }),
    {
      name: "cycling-fuel-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

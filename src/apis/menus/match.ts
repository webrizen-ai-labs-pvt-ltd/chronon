import type { DishData } from "./schema";

/** Lowercase and strip accents so "tiramisu" finds "Tiramisù". */
export function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * A diet filter matches dishes that suit that diet: asking for "vegetarian"
 * also returns vegan dishes, "pescatarian" returns vegan and vegetarian ones too.
 */
const suits: Record<DishData["diet"], DishData["diet"][]> = {
  vegan: ["vegan"],
  vegetarian: ["vegan", "vegetarian"],
  eggetarian: ["vegan", "vegetarian", "eggetarian"],
  pescatarian: ["vegan", "vegetarian", "eggetarian", "pescatarian"],
  non_vegetarian: ["non_vegetarian"],
};

export function dietSatisfies(dishDiet: DishData["diet"], wanted: DishData["diet"]) {
  return suits[wanted].includes(dishDiet);
}

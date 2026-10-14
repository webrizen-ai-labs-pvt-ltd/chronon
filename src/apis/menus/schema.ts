import { z } from "zod";

export const COURSES = [
  "breakfast",
  "starter",
  "main",
  "side",
  "bread",
  "rice",
  "snack",
  "dessert",
  "beverage",
] as const;

/**
 * Strictest first. "vegetarian" follows the Indian usage: no meat, fish or egg
 * (dairy is fine). "eggetarian" adds eggs.
 */
export const DIETS = ["vegan", "vegetarian", "eggetarian", "pescatarian", "non_vegetarian"] as const;

export const REGION_KINDS = ["country", "state", "region", "city"] as const;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase-kebab-case");

export const dishSchema = z.strictObject({
  slug,
  name: z.string().min(1),
  local_name: z.string().min(1).nullable(),
  description: z.string().min(10).max(200),
  course: z.enum(COURSES),
  diet: z.enum(DIETS),
  spice_level: z.number().int().min(0).max(5),
  price_level: z.number().int().min(1).max(3),
  ingredients: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)),
});

export const regionFileSchema = z.strictObject({
  slug,
  name: z.string().min(1),
  kind: z.enum(REGION_KINDS),
  country_code: z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2"),
  country: z.string().min(1),
  summary: z.string().min(10).max(200),
  staples: z.array(z.string().min(1)).min(1),
  dishes: z.array(dishSchema).min(1),
});

export type RegionFile = z.infer<typeof regionFileSchema>;
export type DishData = z.infer<typeof dishSchema>;

/** Query string for GET /v1/menus/dishes and /random. */
export const dishQuerySchema = z.object({
  region: slug.optional(),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((s) => s.toUpperCase())
    .optional(),
  course: z.enum(COURSES).optional(),
  diet: z.enum(DIETS).optional(),
  max_spice: z.coerce.number().int().min(0).max(5).optional(),
  q: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(32).optional(),
});

export type DishQuery = z.infer<typeof dishQuerySchema>;

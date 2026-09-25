'use client';

import type { ReactNode } from 'react';
import {
  Package,
  Apple,
  Coffee,
  Beef,
  Cake,
  CandyCane,
  Cherry,
  Cookie,
  Croissant,
  Dessert,
  Donut,
  Drumstick,
  EggFried,
  Fish,
  IceCream2,
  Milk,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Wheat,
  Wine,
  Beer,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Watch,
  Headphones,
  Smartphone,
  Laptop,
  Monitor,
  Gift,
  Sparkles,
  Flower2,
  Leaf,
  Baby,
  Book,
  Pill,
  Wrench,
  Grid2X2,
} from 'lucide-react';

/**
 * Katalogu i ikonave për kategori (nga libraria lucide-react).
 * Çelësi ruhet në DB (te `categories.icon_name`), komponenti merret nga këtu.
 * Për të shtuar një ikonë të re: importoje më lart dhe shto rreshtin këtu.
 */
export const CATEGORY_ICON_CATALOG = {
  // Ushqim / furrë / pastiçeri
  Bread: Wheat,
  Croissant: Croissant,
  Cake: Cake,
  Donut: Donut,
  Cookie: Cookie,
  Dessert: Dessert,
  Pastry: Sparkles,
  IceCream: IceCream2,
  Candy: CandyCane,
  Cherry: Cherry,
  Apple: Apple,
  // Pije
  Coffee: Coffee,
  Milk: Milk,
  Wine: Wine,
  Beer: Beer,
  // Vakte
  Pizza: Pizza,
  Sandwich: Sandwich,
  Salad: Salad,
  Soup: Soup,
  Fish: Fish,
  Beef: Beef,
  Chicken: Drumstick,
  Egg: EggFried,
  // Retail
  Bag: ShoppingBag,
  Cart: ShoppingCart,
  Shirt: Shirt,
  Watch: Watch,
  Headphones: Headphones,
  Phone: Smartphone,
  Laptop: Laptop,
  Monitor: Monitor,
  // Të tjera
  Gift: Gift,
  Flower: Flower2,
  Leaf: Leaf,
  Baby: Baby,
  Book: Book,
  Pill: Pill,
  Tool: Wrench,
  Default: Package,
  All: Grid2X2,
} as const;

export type CategoryIconName = keyof typeof CATEGORY_ICON_CATALOG;

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICON_CATALOG) as CategoryIconName[];

export function renderCategoryIcon(name: string | null | undefined, size = 24, color?: string): ReactNode {
  const key = (name && (CATEGORY_ICON_CATALOG as Record<string, typeof Package>)[name]) ? (name as CategoryIconName) : 'Default';
  const Icon = CATEGORY_ICON_CATALOG[key];
  return <Icon size={size} color={color} />;
}

import {
  Home,
  Utensils,
  Car,
  Zap,
  Film,
  Heart,
  ShoppingBag,
  GraduationCap,
  Users,
  Package,
  MoreHorizontal,
} from "lucide-react";

export const CATEGORIES = [
  "Housing",
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Shopping",
  "Education",
  "Family",
  "Miscellaneous",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ICONS: Record<Category, typeof Home> = {
  Housing: Home,
  Food: Utensils,
  Transport: Car,
  Utilities: Zap,
  Entertainment: Film,
  Health: Heart,
  Shopping: ShoppingBag,
  Education: GraduationCap,
  Family: Users,
  Miscellaneous: Package,
  Other: MoreHorizontal,
};

export const STORAGE_KEY = "expense-tracker-data";

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
  Other: MoreHorizontal,
};

export const STORAGE_KEY = "expense-tracker-data";

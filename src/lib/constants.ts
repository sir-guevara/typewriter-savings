export const CATEGORIES = [
  "Housing",
  "Food",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Shopping",
  "Education",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const STORAGE_KEY = "expense-tracker-data";

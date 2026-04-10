import type { Category } from "./constants";

export interface ExpenseItem {
  id: string;
  label: string;
  amount: number;
  category: Category;
}

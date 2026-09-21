import { CATEGORIES } from "./constants";
import type { Category } from "./constants";
import type { ExpenseItem } from "./types";

const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

export const expensesToCSV = (expenses: ExpenseItem[]) =>
  ["Label,Category,Amount", ...expenses.map((e) => [esc(e.label), esc(e.category), e.amount].join(","))].join("\n");

export const downloadCSV = (csv: string, filename = "expenses.csv") => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const parseLine = (line: string) => {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

export const csvToExpenses = (text: string): ExpenseItem[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const start = /label/i.test(lines[0]) && /amount/i.test(lines[0]) ? 1 : 0;
  const items: ExpenseItem[] = [];
  for (const line of lines.slice(start)) {
    const [label, category, amount] = parseLine(line);
    const value = parseFloat(String(amount).replace(/[^0-9.-]/g, ""));
    if (!label || isNaN(value)) continue;
    const cat = CATEGORIES.find((c) => c.toLowerCase() === String(category ?? "").toLowerCase());
    items.push({
      id: crypto.randomUUID(),
      label,
      amount: value,
      category: (cat ?? "Other") as Category,
    });
  }
  return items;
};

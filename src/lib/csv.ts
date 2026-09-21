import { CATEGORIES } from "./constants";
import type { Category } from "./constants";
import type { ExpenseItem } from "./types";
import type { DebtItem } from "@/components/DebtTracker";

const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

export const expensesToCSV = (expenses: ExpenseItem[], debts: DebtItem[] = []) => {
  const rows = [
    "Type,Label,Category,Amount,APR,Mode,TargetMonths,MonthlyPayment",
    ...expenses.map((e) => ["Expense", esc(e.label), esc(e.category), e.amount, "", "", "", ""].join(",")),
    ...debts.map((d) =>
      ["Debt", esc(d.name), "", d.balance, d.apr, d.mode, d.mode === "months" ? d.targetMonths : "", d.mode === "payment" ? d.monthlyPayment : ""].join(",")
    ),
  ];
  return rows.join("\n");
};

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

const num = (v: string | undefined) => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));

export const parseCSV = (text: string): { expenses: ExpenseItem[]; debts: DebtItem[] } => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const expenses: ExpenseItem[] = [];
  const debts: DebtItem[] = [];
  if (lines.length === 0) return { expenses, debts };

  const header = lines[0].toLowerCase();
  const hasHeader = /label/i.test(header) && /amount/i.test(header);
  const hasType = hasHeader && /^\s*"?type"?\s*,/i.test(lines[0]);
  const start = hasHeader ? 1 : 0;

  for (const line of lines.slice(start)) {
    const cols = parseLine(line);
    if (hasType) {
      const [type, label, category, amount, apr, mode, targetMonths, monthlyPayment] = cols;
      const value = num(amount);
      if (!label || isNaN(value)) continue;
      if (String(type).toLowerCase() === "debt") {
        const m = String(mode).toLowerCase() === "payment" ? "payment" : "months";
        debts.push({
          id: crypto.randomUUID(),
          name: label,
          balance: value,
          apr: isNaN(num(apr)) ? 0 : num(apr),
          mode: m,
          targetMonths: isNaN(num(targetMonths)) || num(targetMonths) <= 0 ? 12 : Math.round(num(targetMonths)),
          monthlyPayment: isNaN(num(monthlyPayment)) || num(monthlyPayment) <= 0 ? 100 : num(monthlyPayment),
        });
      } else {
        const cat = CATEGORIES.find((c) => c.toLowerCase() === String(category ?? "").toLowerCase());
        expenses.push({
          id: crypto.randomUUID(),
          label,
          amount: value,
          category: (cat ?? "Other") as Category,
        });
      }
    } else {
      // Legacy format: Label,Category,Amount
      const [label, category, amount] = cols;
      const value = num(amount);
      if (!label || isNaN(value)) continue;
      const cat = CATEGORIES.find((c) => c.toLowerCase() === String(category ?? "").toLowerCase());
      expenses.push({
        id: crypto.randomUUID(),
        label,
        amount: value,
        category: (cat ?? "Other") as Category,
      });
    }
  }
  return { expenses, debts };
};

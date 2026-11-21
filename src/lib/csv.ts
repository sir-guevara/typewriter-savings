import { CATEGORIES } from "./constants";
import type { Category } from "./constants";
import type { ExpenseItem } from "./types";
import type { DebtItem } from "@/components/DebtTracker";

import { planStartDate, type SavingsAccount } from "./savings";

const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

export const expensesToCSV = (expenses: ExpenseItem[], debts: DebtItem[] = [], accounts: SavingsAccount[] = [], settings?: { income: number; years: number; startMonth?: string }) => {
  const rows = [
    "Type,Label,Category,Amount,APR,Mode,TargetMonths,MonthlyPayment,Allocation,Goal,AnnualReturn,OverflowWeight,TargetDate,GoalBasis,Priority,PlanStartMonth",
    ...expenses.map((e) => ["Expense", esc(e.label), esc(e.category), e.amount, "", "", "", ""].join(",")),
    ...debts.map((d) =>
      ["Debt", esc(d.name), "", d.balance, d.apr, d.mode, d.mode === "months" ? d.targetMonths : "", d.mode === "payment" ? d.monthlyPayment : ""].join(",")
    ),
    ...accounts.map(a => ["Account", esc(a.name), a.type, a.balance, "", a.mode, "", "", a.allocation, a.goal, a.annualReturn ?? 0, a.overflowWeight ?? 100, esc(a.targetDate ?? ""), a.goalBasis ?? "", a.priority ? "true" : "false"].join(",")),
    ...(settings ? [["Settings", "Plan settings", "", settings.income, "", "", settings.years, "", "", "", "", "", "", "", "", settings.startMonth ?? ""].join(",")] : []),
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

export const parseCSV = (text: string): { expenses: ExpenseItem[]; debts: DebtItem[]; accounts: SavingsAccount[]; settings?: { income: number; years: number; startMonth?: string } } => {
  const lines: string[] = [];
  let record = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { record += '""'; i++; continue; }
      quoted = !quoted;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (record.trim()) lines.push(record);
      record = "";
    } else record += char;
  }
  if (record.trim()) lines.push(record);
  const expenses: ExpenseItem[] = [];
  const debts: DebtItem[] = [];
  const accounts: SavingsAccount[] = [];
  let settings: { income: number; years: number; startMonth?: string } | undefined;
  if (lines.length === 0) return { expenses, debts, accounts };

  const header = lines[0].toLowerCase();
  const hasHeader = /label/i.test(header) && /amount/i.test(header);
  const hasType = hasHeader && /^\s*"?type"?\s*,/i.test(lines[0]);
  const start = hasHeader ? 1 : 0;

  for (const line of lines.slice(start)) {
    const cols = parseLine(line);
    if (hasType) {
      const [type, label, category, amount, apr, mode, targetMonths, monthlyPayment] = cols;
      const value = num(amount);
      if (!label || !Number.isFinite(value) || value < 0) continue;
      if (type.toLowerCase() === "settings") {
        settings = { income: value, years: Math.min(30, Math.max(1, Math.round(num(targetMonths) || 5))), ...(cols[15] && planStartDate(cols[15]).slice(0, 7) === cols[15] ? { startMonth: cols[15] } : {}) };
        continue;
      }
      if (type.toLowerCase() === "account") {
        accounts.push({ id: crypto.randomUUID(), name: label, type: category === "investment" ? "investment" : category === "other" ? "other" : "savings", balance: value, mode: mode === "deadline" && category === "savings" ? "deadline" : mode === "amount" ? "amount" : "percent", ...(cols[12] ? { targetDate: cols[12] } : {}), ...(cols[13] === "living-expenses" ? { goalBasis: "living-expenses" as const } : {}), ...(cols[14] === "true" ? { priority: true } : {}), allocation: Math.max(0, num(cols[8]) || 0), goal: Math.max(0, num(cols[9]) || 0), annualReturn: Math.min(100, Math.max(-100, num(cols[10]) || 0)), overflowWeight: Number.isFinite(num(cols[11])) ? Math.min(100, Math.max(0, num(cols[11]))) : 100 });
        continue;
      }
      if (!["expense", "debt"].includes(type.toLowerCase())) continue;
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
  return { expenses, debts, accounts, settings };
};

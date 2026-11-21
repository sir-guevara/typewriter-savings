import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, DollarSign, Download, FileSpreadsheet, Upload } from "lucide-react";
import { expensesToCSV, parseCSV, downloadCSV } from "@/lib/csv";
import { toast } from "@/hooks/use-toast";
import SavingsAccounts from "@/components/SavingsAccounts";
import PlanStartMonth from "@/components/PlanStartMonth";
import FinancialReport from "@/components/FinancialReport";
import { financialReport, exportFinancialPDF, money } from "@/lib/report";
import { todayDate, planStartDate, ensureEmergencyFund, isEmergencyFund, type SavingsAccount } from "@/lib/savings";
import DebtTracker, { type DebtItem } from "@/components/DebtTracker";
import { CATEGORIES, CATEGORY_ICONS, STORAGE_KEY, type Category } from "@/lib/constants";
import type { ExpenseItem } from "@/lib/types";
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; } }
export default function Index() {
  const [saved] = useState(loadState);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [view, setView] = useState<"report" | "edit">("report");
  const [income, setIncome] = useState<number>(saved?.income ?? 0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => (saved?.expenses ?? []).map((e: ExpenseItem) => ({ ...e, category: e.category || "Other" })));
  const [debts, setDebts] = useState<DebtItem[]>(saved?.debts ?? []);
  const [storedAccounts, setAccounts] = useState<SavingsAccount[]>(() => {
    const existing = saved?.accounts ?? [];
    // Preserve the former general balance as a tracked asset, without continuing its funding rule.
    const migrated = saved?.generalBalance > 0 ? [...existing, { id: crypto.randomUUID(), name: "Previously unassigned balance", type: "other", balance: saved.generalBalance, mode: "amount", allocation: 0, goal: 0 }] : existing;
    return ensureEmergencyFund(migrated, (saved?.expenses ?? []).reduce((sum: number, e: ExpenseItem) => sum + e.amount, 0));
  });
  const monthlyLivingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const accounts = useMemo(() => ensureEmergencyFund(storedAccounts, monthlyLivingExpenses), [storedAccounts, monthlyLivingExpenses]);
  const [startMonth, setStartMonth] = useState(() => planStartDate(saved?.startMonth ?? todayDate().slice(0, 7)).slice(0, 7));
  const [years, setYears] = useState<number>(saved?.years ?? 5);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Other");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ income, expenses, debts, accounts, years, startMonth })); }, [income, expenses, debts, accounts, years, startMonth]);
  const today = planStartDate(startMonth);
  const report = useMemo(() => financialReport(income, expenses, debts, accounts, years, today, selectedMonth), [income, expenses, debts, accounts, years, today, selectedMonth]);
  const totalExpenses = report.spending;
  const formatCurrency = money;
  function addExpense() { const amount = Number(newAmount); if (!newLabel.trim() || !Number.isFinite(amount) || amount <= 0) return; setExpenses(prev => [...prev, { id: crypto.randomUUID(), label: newLabel.trim(), category: newCategory, amount }]); setNewLabel(""); setNewAmount(""); }
  function removeExpense(id: string) { setExpenses(prev => prev.filter(e => e.id !== id)); }
  function updateExpense(id: string, field: "label" | "amount" | "category", value: string) { setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: field === "amount" ? Math.max(0, Number(value) || 0) : value } : e)); }
  async function exportPDF() { setExporting(true); try { await exportFinancialPDF(report); } catch { toast({ title: "PDF export failed", description: "Please try again.", variant: "destructive" }); } finally { setExporting(false); } }
  function exportCSV() { downloadCSV(expensesToCSV(expenses, debts, accounts, { income, years, startMonth }), "financial-plan.csv"); toast({ title: "Full plan exported", description: "Income, expenses, debts, accounts and projection settings saved." }); }
  async function importCSV(file: File) { try { const imported = parseCSV(await file.text()); if (!imported.expenses.length && !imported.debts.length && !imported.accounts.length && !imported.settings) { toast({ title: "No valid data found", variant: "destructive" }); return; } setExpenses(prev => [...prev, ...imported.expenses]); setDebts(prev => [...prev, ...imported.debts]); setAccounts(prev => [...(imported.accounts.some(isEmergencyFund) ? prev.filter(a => !isEmergencyFund(a)) : prev), ...imported.accounts]); if (imported.settings) { setIncome(imported.settings.income); setYears(imported.settings.years); if (imported.settings.startMonth) setStartMonth(imported.settings.startMonth); setSelectedMonth(""); } toast({ title: "Plan imported", description: "Imported items added to your plan." }); } catch { toast({ title: "Import failed", variant: "destructive" }); } }
  return <main className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-12"><div className="dashboard-container mx-auto max-w-2xl">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-5"><div><h1 className="font-display text-3xl md:text-4xl">Your Financial Plan</h1><p className="mt-2 font-body text-sm text-muted-foreground">Earn. Spend. Save with purpose. Invest the rest.</p></div><div className="flex flex-wrap gap-2"><button className="plan-button" onClick={exportCSV}><FileSpreadsheet className="h-4 w-4"/>Export CSV</button><button className="plan-button" disabled={exporting} onClick={exportPDF}><Download className="h-4 w-4"/>{exporting ? "Preparing PDF…" : "Export PDF"}</button></div></header>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4"><div className="flex gap-2" role="tablist" aria-label="Plan view">{([['report', 'Financial report'], ['edit', 'Edit plan']] as const).map(([key, title]) => <button key={key} id={`${key}-tab`} role="tab" aria-selected={view === key} aria-controls={`${key}-panel`} className={`plan-button ${view === key ? 'bg-foreground text-background' : ''}`} onClick={() => setView(key)}>{title}</button>)}</div><span className="font-body text-xs text-muted-foreground">{years}-year outlook · saved on this device</span></div>
    {view === 'report' ? <div id="report-panel" role="tabpanel" aria-labelledby="report-tab"><FinancialReport report={report} onMonthChange={setSelectedMonth}/></div> : <div id="edit-panel" role="tabpanel" aria-labelledby="edit-tab" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-card p-5"><PlanStartMonth value={startMonth} onChange={month => { setStartMonth(month); setSelectedMonth(""); }}/><label className="flex items-center gap-3 font-body text-sm">Projection horizon<select className="rounded-sm border border-border bg-background px-3 py-2" value={years} onChange={e => { setYears(+e.target.value); setSelectedMonth(""); }}>{[...new Set([1, 3, 5, 10, 20, 30, years])].sort((a, b) => a - b).map(y => <option key={y} value={y}>{y} years</option>)}</select></label><input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { if (e.target.files?.[0]) void importCSV(e.target.files[0]); e.target.value = ''; }}/><button className="plan-button" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4"/>Import CSV</button></div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_2fr]"><div className="edit-budget-panel">        {/* Income */}
        <section className="mb-10">
          <label htmlFor="monthly-income" className="mb-2 block font-display text-lg text-foreground">
            Monthly Income
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="monthly-income"
              type="number"
              min={0}
              step="0.01"
              value={income || ""}
              onChange={(e) => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              className="w-full border-b-2 border-border bg-transparent py-3 pl-9 pr-3 font-body text-xl text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            />
          </div>
        </section>

</div><div className="edit-budget-panel">        {/* Expenses */}
        <section className="mb-10">
          <label className="mb-4 block font-display text-lg text-foreground">
            Monthly Expenses
          </label>

          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label"
              onKeyDown={(e) => e.key === "Enter" && addExpense()}
              className="flex-1 min-w-[120px] border-b-2 border-border bg-transparent py-2 font-body text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className="border-b-2 border-border bg-transparent py-2 font-body text-sm text-foreground outline-none focus:border-foreground"
            >
              {CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                return <option key={cat} value={cat}>{cat}</option>;
              })}
            </select>
            <div className="relative">
              <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0"
                onKeyDown={(e) => e.key === "Enter" && addExpense()}
                className="w-28 border-b-2 border-border bg-transparent py-2 pl-6 font-body text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
              />
            </div>
            <button
              aria-label="Add expense"
              onClick={addExpense}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border text-foreground transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <AnimatePresence>
          {expenses.map((expense) => {
              const CatIcon = CATEGORY_ICONS[expense.category];
              return (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="group flex items-center justify-between border-b border-dashed border-border py-3 gap-2"
              >
                <CatIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={expense.label}
                  onChange={(e) => updateExpense(expense.id, "label", e.target.value)}
                  className="flex-1 min-w-0 bg-transparent font-body text-foreground outline-none border-b border-transparent focus:border-foreground transition-colors"
                />
                <select
                  value={expense.category}
                  onChange={(e) => updateExpense(expense.id, "category", e.target.value)}
                  className="bg-transparent font-body text-xs text-muted-foreground outline-none border-b border-transparent focus:border-foreground transition-colors"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <DollarSign className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      value={expense.amount || ""}
                      onChange={(e) => updateExpense(expense.id, "amount", e.target.value)}
                      className="w-24 bg-transparent pl-4 text-right font-body text-muted-foreground outline-none border-b border-transparent focus:border-foreground focus:text-foreground transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => removeExpense(expense.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>

          {expenses.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="font-display text-sm text-muted-foreground">Total</span>
              <span className="font-body font-bold text-foreground">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          )}
        </section>

</div></div>

      <SavingsAccounts asOf={today} accounts={accounts} monthlySavings={report.available} onChange={setAccounts}/>
      <details className="rounded-sm border border-border bg-card p-5"><summary className="cursor-pointer font-display text-lg">Debt payments {debts.length > 0 ? `(${debts.length})` : '(optional)'}</summary><DebtTracker debts={debts} setDebts={setDebts} formatCurrency={money}/></details>
    </div>}
    <footer className="mt-8 border-t border-border py-5 text-center font-body text-xs text-muted-foreground">All data stays in your browser · by Sir Guevara</footer>
  </div></main>;
}

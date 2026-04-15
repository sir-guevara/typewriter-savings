import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, DollarSign, TrendingUp, PiggyBank, Download, Target } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import SavingsChart from "@/components/SavingsChart";
import ExpenseAnalysis from "@/components/ExpenseAnalysis";
import DebtTracker from "@/components/DebtTracker";
import DebtChart from "@/components/DebtChart";
import type { DebtItem } from "@/components/DebtTracker";
import { CATEGORIES, CATEGORY_ICONS, STORAGE_KEY } from "@/lib/constants";
import type { Category } from "@/lib/constants";
import type { ExpenseItem } from "@/lib/types";

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const Index = () => {
  const saved = loadState();
  const [income, setIncome] = useState<number>(saved?.income ?? 0);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    () => (saved?.expenses ?? []).map((e: any) => ({ ...e, category: e.category || "Other" }))
  );
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Other");
  const [years, setYears] = useState<number>(saved?.years ?? 5);
  const [interestRate, setInterestRate] = useState<number>(saved?.interestRate ?? 7);
  const [savingsGoal, setSavingsGoal] = useState<number>(saved?.savingsGoal ?? 0);
  const [debts, setDebts] = useState<DebtItem[]>(saved?.debts ?? []);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const totalDebtPayments = useMemo(() => {
    return debts.reduce((sum, d) => {
      if (d.mode === "months") {
        const r = d.apr / 100 / 12;
        if (r === 0) return sum + d.balance / d.targetMonths;
        return sum + (d.balance * r * Math.pow(1 + r, d.targetMonths)) / (Math.pow(1 + r, d.targetMonths) - 1);
      }
      return sum + d.monthlyPayment;
    }, 0);
  }, [debts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ income, expenses, years, interestRate, savingsGoal, debts }));
  }, [income, expenses, years, interestRate, savingsGoal, debts]);

  const monthlySavings = income - totalExpenses - totalDebtPayments;
  const yearlySavings = monthlySavings * 12;

  const timeToGoal = useMemo(() => {
    if (savingsGoal <= 0 || monthlySavings <= 0) return null;
    const r = interestRate / 100 / 12;
    if (r === 0) {
      const months = savingsGoal / monthlySavings;
      return months;
    }
    const n = Math.log((savingsGoal * r) / monthlySavings + 1) / Math.log(1 + r);
    return n;
  }, [savingsGoal, monthlySavings, interestRate]);

  const formatTimeToGoal = (months: number) => {
    const y = Math.floor(months / 12);
    const m = Math.ceil(months % 12);
    if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
    if (m === 0) return `${y} year${y !== 1 ? "s" : ""}`;
    return `${y} year${y !== 1 ? "s" : ""} ${m} month${m !== 1 ? "s" : ""}`;
  };

  const projectedSavings = useMemo(() => {
    if (monthlySavings <= 0) return 0;
    const r = interestRate / 100 / 12;
    const n = years * 12;
    if (r === 0) return monthlySavings * n;
    return monthlySavings * ((Math.pow(1 + r, n) - 1) / r);
  }, [monthlySavings, interestRate, years]);

  const addExpense = () => {
    const amount = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amount) || amount <= 0) return;
    setExpenses((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: newLabel.trim(), amount, category: newCategory },
    ]);
    setNewLabel("");
    setNewAmount("");
  };

  const removeExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const updateExpense = (id: string, field: "label" | "amount" | "category", value: string) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...(field === "label"
                ? { label: value }
                : field === "category"
                ? { category: value as Category }
                : { amount: parseFloat(value) || 0 }),
            }
          : e
      )
    );
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const exportPDF = useCallback(() => {
    const doc = new jsPDF();
    const fc = formatCurrency;
    let y = 20;

    doc.setFont("courier", "bold");
    doc.setFontSize(20);
    doc.text("Expense Tracker", 105, y, { align: "center" });
    y += 12;

    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 105, y, { align: "center" });
    y += 16;

    doc.setFontSize(14);
    doc.setFont("courier", "bold");
    doc.text("Monthly Income", 14, y);
    y += 8;
    doc.setFont("courier", "normal");
    doc.setFontSize(12);
    doc.text(fc(income), 14, y);
    y += 14;

    if (expenses.length > 0) {
      doc.setFontSize(14);
      doc.setFont("courier", "bold");
      doc.text("Monthly Expenses", 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [["Expense", "Category", "Amount"]],
        body: [
          ...expenses.map((e) => [e.label, e.category, fc(e.amount)]),
          [
            { content: "Total", styles: { fontStyle: "bold" } },
            "",
            { content: fc(totalExpenses), styles: { fontStyle: "bold" } },
          ],
        ],
        styles: { font: "courier", fontSize: 10 },
        headStyles: { fillColor: [45, 45, 45] },
        theme: "grid",
      });

      y = (doc as any).lastAutoTable.finalY + 14;
    }

    doc.setFontSize(14);
    doc.setFont("courier", "bold");
    doc.text("Monthly Savings", 14, y);
    y += 8;
    doc.setFont("courier", "normal");
    doc.setFontSize(12);
    doc.text(fc(monthlySavings), 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(`${fc(yearlySavings)} per year`, 14, y);
    y += 14;

    doc.setFontSize(14);
    doc.setFont("courier", "bold");
    doc.text("Savings Projection", 14, y);
    y += 8;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.text(`In ${years} year${years !== 1 ? "s" : ""} at ${interestRate}% annual return`, 14, y);
    y += 6;
    doc.setFontSize(16);
    doc.setFont("courier", "bold");
    doc.text(fc(projectedSavings), 14, y);

    doc.save("expense-tracker.pdf");
  }, [income, expenses, totalExpenses, monthlySavings, yearlySavings, projectedSavings, years, interestRate]);

  return (
    <div className="min-h-screen bg-background px-4 py-12 md:py-20">
      <div className="mx-auto max-w-2xl">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2 text-center font-display text-4xl tracking-wide text-foreground md:text-5xl"
        >
          Expense Tracker
        </motion.h1>
        <p className="mb-12 text-center font-body text-sm text-muted-foreground">
          income — expenses — savings projection
        </p>

        <div className="mb-8 flex justify-end">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 rounded-sm border border-border px-4 py-2 font-body text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>

        {/* Income */}
        <section className="mb-10">
          <label className="mb-2 block font-display text-lg text-foreground">
            Monthly Income
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="number"
              value={income || ""}
              onChange={(e) => setIncome(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full border-b-2 border-border bg-transparent py-3 pl-9 pr-3 font-body text-xl text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            />
          </div>
        </section>

        {/* Expenses */}
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

        {/* Summary */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10 rounded-sm border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <PiggyBank className="h-5 w-5 text-foreground" />
            <h2 className="font-display text-lg text-foreground">Monthly Savings</h2>
          </div>
          <p
            className={`font-body text-3xl font-bold ${
              monthlySavings >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {formatCurrency(monthlySavings)}
          </p>
          {totalDebtPayments > 0 && (
            <p className="mt-2 font-body text-xs text-muted-foreground">
              incl. {formatCurrency(totalDebtPayments)}/mo in debt payments
            </p>
          )}
          <p className="mt-1 font-body text-xs text-muted-foreground">
            {monthlySavings >= 0
              ? `${formatCurrency(yearlySavings)} per year`
              : "You're spending more than you earn"}
          </p>
        </motion.section>

        {/* Projection */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-sm border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-foreground" />
            <h2 className="font-display text-lg text-foreground">Savings Projection</h2>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-6">
            <div>
              <label className="mb-1 block font-body text-xs text-muted-foreground">Years</label>
              <input
                type="number"
                min={1}
                max={50}
                value={years}
                onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border-b-2 border-border bg-transparent py-2 font-body text-lg text-foreground outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block font-body text-xs text-muted-foreground">Interest Rate (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={interestRate}
                onChange={(e) => setInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full border-b-2 border-border bg-transparent py-2 font-body text-lg text-foreground outline-none focus:border-foreground"
              />
            </div>
          </div>

          <div className="border-t border-dashed border-border pt-4">
            <p className="font-body text-xs text-muted-foreground">
              In {years} year{years !== 1 ? "s" : ""} at {interestRate}% annual return
            </p>
            <p
              className={`mt-1 font-body text-3xl font-bold ${
                projectedSavings > 0 ? "text-success" : "text-muted-foreground"
              }`}
            >
              {formatCurrency(projectedSavings)}
            </p>
            <p className="mt-1 font-body text-xs text-muted-foreground">
              with compound interest (monthly contributions)
            </p>
          </div>
        </motion.section>

        {/* Savings Goal */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-10 rounded-sm border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <Target className="h-5 w-5 text-foreground" />
            <h2 className="font-display text-lg text-foreground">Savings Goal</h2>
          </div>

          <div className="relative mb-6">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="number"
              value={savingsGoal || ""}
              onChange={(e) => setSavingsGoal(parseFloat(e.target.value) || 0)}
              placeholder="Enter your target amount"
              className="w-full border-b-2 border-border bg-transparent py-3 pl-9 pr-3 font-body text-xl text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            />
          </div>

          {savingsGoal > 0 && (
            <div className="border-t border-dashed border-border pt-4">
              {monthlySavings <= 0 ? (
                <p className="font-body text-sm text-destructive">
                  You need positive monthly savings to reach your goal
                </p>
              ) : timeToGoal !== null ? (
                <>
                  <p className="font-body text-xs text-muted-foreground">
                    At {formatCurrency(monthlySavings)}/mo with {interestRate}% return
                  </p>
                  <p className="mt-1 font-body text-3xl font-bold text-success">
                    {formatTimeToGoal(timeToGoal)}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted-foreground">
                    to reach {formatCurrency(savingsGoal)}
                  </p>
                </>
              ) : null}
            </div>
          )}
        </motion.section>

        {/* Savings Growth Chart */}
        <SavingsChart
          monthlySavings={monthlySavings}
          interestRate={interestRate}
          years={years}
          savingsGoal={savingsGoal}
          formatCurrency={formatCurrency}
        />

        {/* Debt Payoff */}
        <DebtTracker debts={debts} setDebts={setDebts} formatCurrency={formatCurrency} />
        <DebtChart debts={debts} formatCurrency={formatCurrency} />

        {/* Category Analysis */}
        <ExpenseAnalysis expenses={expenses} totalDebtPayments={totalDebtPayments} formatCurrency={formatCurrency} />

        <p className="mt-12 text-center font-body text-xs text-muted-foreground">
          all data stays in your browser · <b>by Sir Guevara</b>
        </p>
      </div>
    </div>
  );
};

export default Index;

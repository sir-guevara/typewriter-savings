import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, Plus, Trash2, DollarSign, Calendar, CreditCard } from "lucide-react";

export interface DebtItem {
  id: string;
  name: string;
  balance: number;
  apr: number;
  mode: "months" | "payment";
  targetMonths: number;
  monthlyPayment: number;
}

interface DebtTrackerProps {
  debts: DebtItem[];
  setDebts: React.Dispatch<React.SetStateAction<DebtItem[]>>;
  formatCurrency: (n: number) => string;
}

const calcMonthlyPayment = (balance: number, apr: number, months: number) => {
  const r = apr / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
};

const calcMonthsToPayoff = (balance: number, apr: number, payment: number) => {
  const r = apr / 100 / 12;
  if (r === 0) return balance / payment;
  if (payment <= balance * r) return Infinity;
  return -Math.log(1 - (balance * r) / payment) / Math.log(1 + r);
};

const formatMonths = (months: number) => {
  if (!isFinite(months)) return "Never (payment too low)";
  const y = Math.floor(months / 12);
  const m = Math.ceil(months % 12);
  if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
  if (m === 0) return `${y} year${y !== 1 ? "s" : ""}`;
  return `${y}y ${m}mo`;
};

const DebtTracker = ({ debts, setDebts, formatCurrency }: DebtTrackerProps) => {
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [newApr, setNewApr] = useState("");

  const addDebt = () => {
    const balance = parseFloat(newBalance);
    if (!newName.trim() || isNaN(balance) || balance <= 0) return;
    setDebts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newName.trim(),
        balance,
        apr: parseFloat(newApr) || 0,
        mode: "months",
        targetMonths: 24,
        monthlyPayment: 0,
      },
    ]);
    setNewName("");
    setNewBalance("");
    setNewApr("");
  };

  const updateDebt = (id: string, updates: Partial<DebtItem>) => {
    setDebts((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const removeDebt = (id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  const totalDebt = useMemo(() => debts.reduce((sum, d) => sum + d.balance, 0), [debts]);
  const totalMonthlyMin = useMemo(
    () =>
      debts.reduce((sum, d) => {
        if (d.mode === "months") return sum + calcMonthlyPayment(d.balance, d.apr, d.targetMonths);
        return sum + d.monthlyPayment;
      }, 0),
    [debts]
  );

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-10 rounded-sm border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Landmark className="h-5 w-5 text-foreground" />
        <h2 className="font-display text-lg text-foreground">Debt Payoff Planner</h2>
      </div>

      {/* Add new debt */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Debt name"
          onKeyDown={(e) => e.key === "Enter" && addDebt()}
          className="flex-1 min-w-[100px] border-b-2 border-border bg-transparent py-2 font-body text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
        />
        <div className="relative">
          <DollarSign className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="number"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            placeholder="Balance"
            onKeyDown={(e) => e.key === "Enter" && addDebt()}
            className="w-28 border-b-2 border-border bg-transparent py-2 pl-6 font-body text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        </div>
        <input
          type="number"
          value={newApr}
          onChange={(e) => setNewApr(e.target.value)}
          placeholder="APR %"
          onKeyDown={(e) => e.key === "Enter" && addDebt()}
          className="w-20 border-b-2 border-border bg-transparent py-2 font-body text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
        />
        <button
          onClick={addDebt}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border text-foreground transition-colors hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Debt list */}
      <AnimatePresence>
        {debts.map((debt) => {
          const monthlyFromTarget = calcMonthlyPayment(debt.balance, debt.apr, debt.targetMonths);
          const monthsFromPayment = calcMonthsToPayoff(debt.balance, debt.apr, debt.monthlyPayment);

          return (
            <motion.div
              key={debt.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="group border-b border-dashed border-border py-4"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-body font-medium text-foreground">{debt.name}</span>
                <span className="font-body text-sm text-destructive font-bold">
                  {formatCurrency(debt.balance)}
                </span>
                <span className="font-body text-xs text-muted-foreground">{debt.apr}% APR</span>
                <button
                  onClick={() => removeDebt(debt.id)}
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Toggle mode */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => updateDebt(debt.id, { mode: "months" })}
                  className={`px-3 py-1 rounded-sm font-body text-xs transition-colors ${
                    debt.mode === "months"
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Calendar className="inline h-3 w-3 mr-1" />
                  Set timeline
                </button>
                <button
                  onClick={() => updateDebt(debt.id, { mode: "payment" })}
                  className={`px-3 py-1 rounded-sm font-body text-xs transition-colors ${
                    debt.mode === "payment"
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <DollarSign className="inline h-3 w-3 mr-1" />
                  Set payment
                </button>
              </div>

              {debt.mode === "months" ? (
                <div className="flex items-center gap-3">
                  <label className="font-body text-xs text-muted-foreground whitespace-nowrap">
                    Pay off in
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={360}
                    value={debt.targetMonths}
                    onChange={(e) =>
                      updateDebt(debt.id, { targetMonths: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-16 border-b border-border bg-transparent py-1 text-center font-body text-foreground outline-none focus:border-foreground"
                  />
                  <span className="font-body text-xs text-muted-foreground">months →</span>
                  <span className="font-body text-sm font-bold text-success">
                    {formatCurrency(monthlyFromTarget)}/mo
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className="font-body text-xs text-muted-foreground whitespace-nowrap">
                    Pay
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-1 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      min={1}
                      value={debt.monthlyPayment || ""}
                      onChange={(e) =>
                        updateDebt(debt.id, { monthlyPayment: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="0"
                      className="w-24 border-b border-border bg-transparent py-1 pl-4 font-body text-foreground outline-none focus:border-foreground"
                    />
                  </div>
                  <span className="font-body text-xs text-muted-foreground">/mo →</span>
                  <span className="font-body text-sm font-bold text-success">
                    {debt.monthlyPayment > 0 ? formatMonths(monthsFromPayment) : "—"}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Summary */}
      {debts.length > 0 && (
        <div className="mt-4 border-t border-border pt-4 flex justify-between items-center">
          <div>
            <p className="font-body text-xs text-muted-foreground">Total debt</p>
            <p className="font-body text-xl font-bold text-destructive">{formatCurrency(totalDebt)}</p>
          </div>
          <div className="text-right">
            <p className="font-body text-xs text-muted-foreground">Total monthly payments</p>
            <p className="font-body text-lg font-bold text-foreground">
              {formatCurrency(totalMonthlyMin)}
            </p>
          </div>
        </div>
      )}
    </motion.section>
  );
};

export default DebtTracker;

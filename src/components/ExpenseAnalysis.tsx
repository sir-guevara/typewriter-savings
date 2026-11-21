import { useMemo } from "react";
import { motion } from "framer-motion";
import { PieChart as PieChartIcon, Landmark } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ExpenseItem } from "@/lib/types";
import type { Category } from "@/lib/constants";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";

interface Props {
  expenses: ExpenseItem[];
  totalDebtPayments?: number;
  formatCurrency: (n: number) => string;
}

type BreakdownItem = {
  label: string;
  amount: number;
  percentage: number;
  icon: React.ComponentType<{ className?: string }>;
};

const ExpenseAnalysis = ({ expenses, totalDebtPayments = 0, formatCurrency }: Props) => {
  const categoryData = useMemo(() => {
    const totals = new Map<Category, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    }
    const grandTotal = expenses.reduce((s, e) => s + e.amount, 0) + totalDebtPayments;

    const items: BreakdownItem[] = CATEGORIES.map((cat) => ({
      label: cat,
      amount: totals.get(cat) || 0,
      percentage: grandTotal > 0 ? ((totals.get(cat) || 0) / grandTotal) * 100 : 0,
      icon: CATEGORY_ICONS[cat],
    })).filter((d) => d.amount > 0);

    if (totalDebtPayments > 0) {
      items.push({
        label: "Debt Payments",
        amount: totalDebtPayments,
        percentage: grandTotal > 0 ? (totalDebtPayments / grandTotal) * 100 : 0,
        icon: Landmark,
      });
    }

    return items.sort((a, b) => b.amount - a.amount);
  }, [expenses, totalDebtPayments]);

  const colors = ["#426b50", "#8a9a6d", "#bca375", "#78959a", "#a88982", "#8d819d", "#a7bba0", "#c9b397", "#687d72", "#b9acbf", "#9b9d85", "#73848c"];
  const total = categoryData.reduce((sum, item) => sum + item.amount, 0);

  const maxAmount = categoryData[0]?.amount || 1;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-10 rounded-sm border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <PieChartIcon className="h-5 w-5 text-foreground" />
        <h2 className="font-display text-lg text-foreground">Expense Breakdown</h2>
      </div>

      <p className="-mt-3 mb-4 font-body text-xs text-muted-foreground">A clearer view of your monthly spending.</p>
      {total > 0 ? <div className="relative mb-5 h-64" role="img" aria-label={`Monthly spending by category, totaling ${formatCurrency(total)}. Category amounts are listed below.`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={categoryData} dataKey="amount" nameKey="label" innerRadius={78} outerRadius={108} paddingAngle={2} stroke="none">
              {categoryData.map((item, i) => <Cell key={item.label} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 3, fontFamily: "var(--font-body)", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-body text-xs text-muted-foreground">Monthly spending</span>
          <strong className="mt-2 font-body text-2xl">{formatCurrency(total)}</strong>
          <span className="mt-1 font-body text-xs text-muted-foreground">{categoryData.length} categories</span>
        </div>
      </div> : <div className="mb-5 flex h-56 flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-border text-center"><PieChartIcon className="h-9 w-9 text-muted-foreground/50"/><p className="font-body text-sm text-muted-foreground">Your spending picture starts here.</p><p className="max-w-64 font-body text-xs text-muted-foreground">Add an expense to see your category breakdown.</p></div>}
      <div className="space-y-4">
        {categoryData.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="font-body text-sm text-foreground">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-xs text-muted-foreground">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="font-body text-sm font-bold text-foreground w-24 text-right">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-sm bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.amount / maxAmount) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-sm"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {categoryData.length > 0 && <div className="mt-6 border-t border-dashed border-border pt-4">
        {(() => {
          const TopIcon = categoryData[0].icon;
          return (
            <>
              <p className="font-body text-xs text-muted-foreground mb-2">Top spending category</p>
              <div className="flex items-center gap-2">
                <TopIcon className="h-4 w-4 text-foreground" />
                <p className="font-display text-lg text-foreground">
                  {categoryData[0].label}
                </p>
              </div>
              <p className="font-body text-sm text-muted-foreground">
                {formatCurrency(categoryData[0].amount)} · {categoryData[0].percentage.toFixed(1)}% of total
              </p>
            </>
          );
        })()}
      </div>}
    </motion.section>
  );
};

export default ExpenseAnalysis;

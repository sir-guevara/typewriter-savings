import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import type { ExpenseItem } from "@/lib/types";
import type { Category } from "@/lib/constants";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/constants";

interface Props {
  expenses: ExpenseItem[];
  formatCurrency: (n: number) => string;
}

const ExpenseAnalysis = ({ expenses, formatCurrency }: Props) => {
  const categoryData = useMemo(() => {
    const totals = new Map<Category, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    }
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    return CATEGORIES.map((cat) => ({
      category: cat,
      amount: totals.get(cat) || 0,
      percentage: totalExpenses > 0 ? ((totals.get(cat) || 0) / totalExpenses) * 100 : 0,
    }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  if (categoryData.length === 0) return null;

  const maxAmount = categoryData[0]?.amount || 1;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-10 rounded-sm border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-5 w-5 text-foreground" />
        <h2 className="font-display text-lg text-foreground">Expense Breakdown</h2>
      </div>

      <div className="space-y-4">
        {categoryData.map((item) => {
          const Icon = CATEGORY_ICONS[item.category];
          return (
            <div key={item.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-body text-sm text-foreground">{item.category}</span>
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
                  className="h-full rounded-sm bg-foreground/70"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-dashed border-border pt-4">
        {(() => {
          const TopIcon = CATEGORY_ICONS[categoryData[0].category];
          return (
            <>
              <p className="font-body text-xs text-muted-foreground mb-2">Top spending category</p>
              <div className="flex items-center gap-2">
                <TopIcon className="h-4 w-4 text-foreground" />
                <p className="font-display text-lg text-foreground">
                  {categoryData[0].category}
                </p>
              </div>
              <p className="font-body text-sm text-muted-foreground">
                {formatCurrency(categoryData[0].amount)} · {categoryData[0].percentage.toFixed(1)}% of total
              </p>
            </>
          );
        })()}
      </div>
    </motion.section>
  );
};

export default ExpenseAnalysis;

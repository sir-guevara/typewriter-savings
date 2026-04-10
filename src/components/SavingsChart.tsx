import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  monthlySavings: number;
  interestRate: number;
  years: number;
  savingsGoal: number;
  formatCurrency: (n: number) => string;
}

const SavingsChart = ({ monthlySavings, interestRate, years, savingsGoal, formatCurrency }: Props) => {
  const chartData = useMemo(() => {
    if (monthlySavings <= 0) return [];
    const r = interestRate / 100 / 12;
    const data = [];
    for (let y = 1; y <= years; y++) {
      const n = y * 12;
      const total = r === 0
        ? monthlySavings * n
        : monthlySavings * ((Math.pow(1 + r, n) - 1) / r);
      data.push({ year: `Y${y}`, savings: Math.round(total) });
    }
    return data;
  }, [monthlySavings, interestRate, years]);

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
        <p className="font-body text-xs text-muted-foreground">{label}</p>
        <p className="font-body text-sm font-bold text-foreground">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-10 rounded-sm border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-foreground" />
        <h2 className="font-display text-lg text-foreground">Growth Over Time</h2>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 82%)" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fontFamily: "Courier Prime, monospace", fill: "hsl(0 0% 40%)" }}
              axisLine={{ stroke: "hsl(30 15% 82%)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "Courier Prime, monospace", fill: "hsl(0 0% 40%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(30 12% 88% / 0.5)" }} />
            <Bar
              dataKey="savings"
              fill="hsl(0 0% 8%)"
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
            {savingsGoal > 0 && (
              <CartesianGrid
                horizontalPoints={[]}
                verticalPoints={[]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {savingsGoal > 0 && (
        <p className="mt-3 font-body text-xs text-muted-foreground text-center">
          Goal: {formatCurrency(savingsGoal)}
        </p>
      )}
    </motion.section>
  );
};

export default SavingsChart;

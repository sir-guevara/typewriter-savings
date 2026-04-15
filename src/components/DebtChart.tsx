import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingDown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { DebtItem } from "./DebtTracker";

const COLORS = [
  "hsl(0 65% 50%)",
  "hsl(25 80% 55%)",
  "hsl(45 75% 50%)",
  "hsl(200 60% 45%)",
  "hsl(270 50% 55%)",
  "hsl(160 55% 40%)",
];

interface Props {
  debts: DebtItem[];
  formatCurrency: (n: number) => string;
}

const calcMonthlyPayment = (balance: number, apr: number, months: number) => {
  const r = apr / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
};

const DebtChart = ({ debts, formatCurrency }: Props) => {
  const chartData = useMemo(() => {
    if (debts.length === 0) return [];

    // For each debt, compute the monthly payment being used
    const debtPayments = debts.map((d) => {
      const payment =
        d.mode === "months"
          ? calcMonthlyPayment(d.balance, d.apr, d.targetMonths)
          : d.monthlyPayment;
      return { ...d, payment };
    });

    // Find max months across all debts
    const maxMonths = Math.max(
      ...debtPayments.map((d) => {
        if (d.payment <= 0) return 0;
        const r = d.apr / 100 / 12;
        if (r === 0) return Math.ceil(d.balance / d.payment);
        if (d.payment <= d.balance * r) return 120;
        return Math.ceil(-Math.log(1 - (d.balance * r) / d.payment) / Math.log(1 + r));
      })
    );

    if (maxMonths <= 0 || !isFinite(maxMonths)) return [];

    const cappedMonths = Math.min(maxMonths, 360);
    // Generate data points (monthly or yearly depending on length)
    const step = cappedMonths > 60 ? 12 : cappedMonths > 24 ? 3 : 1;
    const data = [];

    for (let m = 0; m <= cappedMonths; m += step) {
      const point: Record<string, any> = {
        month: m,
        label: step >= 12 ? `Y${Math.round(m / 12)}` : `M${m}`,
      };

      debtPayments.forEach((d) => {
        if (d.payment <= 0) {
          point[d.name] = d.balance;
          return;
        }
        const r = d.apr / 100 / 12;
        if (r === 0) {
          point[d.name] = Math.max(0, Math.round(d.balance - d.payment * m));
        } else {
          const remaining =
            d.balance * Math.pow(1 + r, m) -
            d.payment * ((Math.pow(1 + r, m) - 1) / r);
          point[d.name] = Math.max(0, Math.round(remaining));
        }
      });

      data.push(point);
    }

    return data;
  }, [debts]);

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-sm border border-border bg-card px-3 py-2 shadow-sm">
        <p className="font-body text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="font-body text-xs" style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{formatCurrency(p.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.45 }}
      className="mt-6 rounded-sm border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <TrendingDown className="h-5 w-5 text-foreground" />
        <h2 className="font-display text-lg text-foreground">Debt Payoff Timeline</h2>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 82%)" vertical={false} />
            <XAxis
              dataKey="label"
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
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "Courier Prime, monospace" }}
            />
            {debts.map((d, i) => (
              <Area
                key={d.id}
                type="monotone"
                dataKey={d.name}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
};

export default DebtChart;

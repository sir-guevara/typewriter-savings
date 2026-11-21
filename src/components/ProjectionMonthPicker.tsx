import { monthLabel } from '@/lib/savings';
import { ChevronDown } from 'lucide-react';

interface Props {
  value: string;
  min: string;
  max: string;
  onChange: (month: string) => void;
}

// Use a regular select so choosing a month does not depend on a browser's
// implementation of input[type=month] or locale-specific text entry.
export default function ProjectionMonthPicker({ value, min, max, onChange }: Props) {
  const [firstYear, firstMonth] = min.split('-').map(Number);
  const [lastYear, lastMonth] = max.split('-').map(Number);
  const count = (lastYear - firstYear) * 12 + lastMonth - firstMonth + 1;
  const months = Array.from({ length: count }, (_, i) => ({
    label: `${monthLabel(new Date(Date.UTC(firstYear, firstMonth - 1 + i, 1)).toISOString().slice(0, 7))} (Month ${i + 1})`,
    value: new Date(Date.UTC(firstYear, firstMonth - 1 + i, 1)).toISOString().slice(0, 7),
  }));

  return <label className="font-body text-xs text-muted-foreground">
    Inspect a month
    <span className="relative mt-1 block">
      <select
        aria-label="Inspect a projected month"
        className="block w-full appearance-none rounded-sm border border-border bg-background py-2 pl-3 pr-9 font-body text-sm text-foreground"
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">Full outlook</option>
        {months.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"/>
    </span>
  </label>;
}

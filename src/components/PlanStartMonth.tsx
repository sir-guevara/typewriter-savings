import { ChevronDown } from 'lucide-react';

export default function PlanStartMonth({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const [year, month] = value.split('-');
  const currentYear = new Date().getFullYear();
  const years = [...new Set([...Array.from({ length: 16 }, (_, i) => currentYear - 5 + i), Number(year)])].sort((a, b) => a - b);
  const field = 'appearance-none rounded-sm border border-border bg-background py-2 pl-3 pr-9 font-body text-sm';
  return <fieldset><legend className="mb-2 font-body text-sm">Month 1 starts in</legend><div className="flex flex-wrap gap-2">
    <span className="relative"><select aria-label="Month 1 month" className={field} value={month} onChange={e => onChange(`${year}-${e.target.value}`)}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{new Date(Date.UTC(2000, i, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"/></span>
    <span className="relative"><select aria-label="Month 1 year" className={field} value={year} onChange={e => onChange(`${e.target.value}-${month}`)}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"/></span>
  </div></fieldset>;
}

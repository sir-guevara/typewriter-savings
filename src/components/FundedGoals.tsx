import HelpTip from './HelpTip';
import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { money } from '@/lib/report';

export interface FundedGoal {
  id: string;
  name: string;
  balance: number;
  goal: number;
  contribution?: number;
  opening?: number;
  newlyFunded?: boolean;
  projected?: boolean;
}
export default function FundedGoals({ goals, renderEditor }: { goals: FundedGoal[]; renderEditor?: (id: string) => ReactNode }) {
  if (!goals.length) return null;
  return <section aria-label="Funded goals" className="funded-goals mt-6 rounded-sm border p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-display text-lg"><ShieldCheck className="h-5 w-5"/>Funded goals <span className="funded-count font-body text-xs">{goals.length}</span><HelpTip label="Funded savings">These savings goals are fully covered. Balances stay set aside; future contributions follow your funding rule. If a balance falls below its goal, the account returns to active funding. Projected goals assume all earlier planned deposits were made.</HelpTip></h3></div>
      <div className="font-body text-right"><p className="text-xs">{goals.some(g => g.projected) ? 'Projected reserves' : 'Set aside'}</p><p className="mt-1 text-xl font-bold">{money(goals.reduce((sum, g) => sum + g.balance, 0))}</p></div>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{goals.map(goal => <article key={goal.id} className="funded-goal-card rounded-sm border p-4">
      <div className="flex items-start justify-between gap-3"><b className="font-body text-sm">{goal.name}</b><span className="flex shrink-0 items-center gap-1 font-body text-xs"><CheckCircle2 className="h-4 w-4"/>{goal.newlyFunded ? 'Funded this month' : 'Funded'}</span></div>
      <p className="mt-4 font-body text-xl font-bold">{money(goal.balance)}</p><p className="mt-1 font-body text-xs">Goal {money(goal.goal)} · 100% funded</p>
      {goal.contribution !== undefined && <div className="mt-3 border-t border-success/20 pt-3 font-body text-xs leading-relaxed"><p>{goal.opening !== undefined ? `Start of month: ${money(goal.opening)}. ` : ''}<b>{money(goal.contribution)} to contribute this month.</b></p>{goal.contribution > 0 && <p className="mt-1">Make this final deposit to finish the goal.</p>}</div>}
      {renderEditor && <details className="mt-4 border-t border-success/20 pt-3"><summary className="cursor-pointer font-body text-xs">Update account</summary><div className="mt-3">{renderEditor(goal.id)}</div></details>}
    </article>)}</div>
  </section>;
}

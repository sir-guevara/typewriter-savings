import { useMemo, useState } from "react";
import { Check, Landmark, Plus, Trash2 } from "lucide-react";
import { PRIORITY_FUNDING_RULE, isFundedSavings, monthsToGoal, deadlineContribution, projectedGoalDate, targetDateLabel, todayDate, savingsPlan, projectPortfolio, type SavingsAccount } from "@/lib/savings";

import HelpTip from "./HelpTip";
import FundedGoals from "./FundedGoals";

interface Props {
  accounts: SavingsAccount[];
  onChange: (accounts: SavingsAccount[]) => void;
  monthlySavings: number;
  asOf?: string;
}
const currency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const numeric = (value: string) => Number.isFinite(+value) ? Math.max(0, +value) : 0;
const field = "w-full min-w-0 rounded-sm border border-border bg-background px-3 py-2 font-body text-sm outline-none focus:border-foreground";
const presets = ["Buffer account", "Gifts", "Vacation", "Partner"];
function timeline(months: number) {
  if (months === 0) return "Goal reached";
  const years = Math.floor(months / 12), remainder = months % 12;
  return [years ? `${years} year${years === 1 ? "" : "s"}` : "", remainder ? `${remainder} month${remainder === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
}
export default function SavingsAccounts({ accounts, onChange, monthlySavings, asOf }: Props) {
  const [name, setName] = useState("");
  const [newType, setNewType] = useState<"savings" | "investment">("savings");
  const today = asOf ?? todayDate();
  const plan = useMemo(() => savingsPlan(accounts, monthlySavings, today), [accounts, monthlySavings, today]);
  const projections = useMemo(() => projectPortfolio(accounts, monthlySavings, 0, today), [accounts, monthlySavings, today]);
  const investmentWeight = accounts.filter(a => a.type === "investment").reduce((sum, a) => sum + (a.overflowWeight ?? 100), 0);
  const [removed, setRemoved] = useState<SavingsAccount | null>(null);
  function update(id: string, updates: Partial<SavingsAccount>) {
    onChange(accounts.map(a => a.id === id ? { ...a, ...updates } : a));
  }
  function add(accountName: string, type: "savings" | "investment" = newType) {
    if (!accountName.trim()) return;
    onChange([...accounts, { id: crypto.randomUUID(), name: accountName.trim(), type, annualReturn: 0, overflowWeight: 100, balance: 0, mode: "percent", allocation: 0, goal: 0 }]);
    setName("");
  }
  function renderAccount(account: SavingsAccount, i: number) {
      const months = (account.type === "investment" || plan.priorityMode) ? projections?.[i].goalMonths ?? null : monthsToGoal(account, monthlySavings, today);
      const deadline = account.type === "savings" && account.mode === "deadline" ? deadlineContribution(account, today) : null;
      const estimatedDate = projectedGoalDate(months, today);
      const missesDeadline = account.priority && account.mode === "deadline" && account.targetDate && (!estimatedDate || estimatedDate > account.targetDate);
      const complete = account.goal > 0 && account.balance >= account.goal;
      const contribution = plan.contributions[i];
      const percent = account.goal > 0 ? Math.min(100, account.balance / account.goal * 100) : 0;
      return <article key={account.id} className="rounded-sm border border-border bg-background p-4">
        <div className="mb-4 flex items-center gap-2">
          <input aria-label={`Account name ${i + 1}`} className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 font-body font-bold outline-none focus:border-foreground" value={account.name} maxLength={80} onChange={e => update(account.id, { name: e.target.value })}/>
          <HelpTip label={`${account.name} settings`}><p>{account.type === "investment" ? "Investments receive the amount left after fixed savings and the priority split. Overflow weights divide that investment amount proportionally; annual return is a separate assumption, compounded monthly. Investment goals are milestones and do not stop contributions." : account.type === "savings" ? "Fixed amounts, fixed percentages and deadline contributions are funded before the remainder is split. Percentages use the full amount left after expenses and debt payments. Leave a goal blank for ongoing fixed savings. Savings stop at their goal and resume if the balance falls below it." : "Tracking-only balances are included in net worth but receive no automatic contributions."}</p><p>Balances are opening values for Month 1. This calculator does not transfer money or place trades.</p></HelpTip>
          {account.goalBasis !== "living-expenses" && <button type="button" aria-label={`Remove ${account.name}`} title="Remove account from plan" onClick={() => { setRemoved(account); onChange(accounts.filter(a => a.id !== account.id)); }} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="font-body text-xs text-muted-foreground">Account type<select className={`${field} mt-1`} value={account.type} disabled={account.goalBasis === "living-expenses"} onChange={e => update(account.id, { type: e.target.value as SavingsAccount["type"], ...(account.mode === "deadline" && e.target.value !== "savings" ? { mode: "amount" as const, allocation: 0 } : {}) })}><option value="savings">Savings</option><option value="investment">Investment</option><option value="other">Other / tracking only</option></select></label>
          <label className="font-body text-xs text-muted-foreground">Current balance ($)<input className={`${field} mt-1`} type="number" min={0} step="0.01" value={account.balance || ""} placeholder="0" onChange={e => update(account.id, { balance: numeric(e.target.value) })}/></label>
          {account.type === "savings" && <label className="col-span-2 flex items-center gap-2 font-body text-sm"><input type="checkbox" aria-label={`Priority for ${account.name}`} checked={account.priority ?? false} onChange={e => update(account.id, { priority: e.target.checked })}/>Priority savings</label>}
          {account.type !== "other" && <>
            {account.type === "savings" && !account.priority && <>
            <label className="font-body text-xs text-muted-foreground">Allocation method<select className={`${field} mt-1`} value={account.mode} onChange={e => update(account.id, { mode: e.target.value as SavingsAccount["mode"], allocation: 0 })}><option value="percent">% of monthly savings</option><option value="amount">Fixed monthly amount ($)</option>{account.type === "savings" && <option value="deadline">Reach goal by a date</option>}</select></label>
            {account.mode === "deadline" ? <label className="font-body text-xs text-muted-foreground">Reach by<input type="date" className={`${field} mt-1`} min={today} value={account.targetDate ?? ""} onChange={e => update(account.id, { targetDate: e.target.value })}/></label> : <label className="font-body text-xs text-muted-foreground">{account.mode === "percent" ? "Allocation (%)" : "Allocation ($ / month)"}<input className={`${field} mt-1`} type="number" min={0} max={account.mode === "percent" ? 100 : undefined} step="0.01" placeholder="0" value={account.allocation || ""} onChange={e => update(account.id, { allocation: account.mode === "percent" ? Math.min(100, numeric(e.target.value)) : numeric(e.target.value) })}/></label>}
            </>}
            {account.priority && account.type === "savings" && <label className="col-span-2 font-body text-xs text-muted-foreground">Reach by (optional target)<input type="date" className={`${field} mt-1`} value={account.targetDate ?? ""} onChange={e => update(account.id, { targetDate: e.target.value, mode: e.target.value ? "deadline" : "percent" })}/></label>}
            {account.goalBasis === "living-expenses" ? <div className="col-span-2 font-body text-xs text-muted-foreground"><span>Emergency fund goal · automatic <HelpTip label="Emergency fund target">Six times monthly living expenses, excluding debt payments. The goal updates with your budget; choose a fixed allocation, deadline or priority funding.</HelpTip></span><p className="mt-1 rounded-sm border border-border bg-card px-3 py-2 font-body text-sm font-bold text-foreground">{currency(account.goal)}</p>{account.goal === 0 && <p className="mt-2">Add expenses to calculate your target.</p>}</div> : <label className="col-span-2 font-body text-xs text-muted-foreground">Account goal ($)<input className={`${field} mt-1`} type="number" min={0} step="0.01" placeholder="No goal limit" value={account.goal || ""} onChange={e => update(account.id, { goal: numeric(e.target.value) })}/></label>}
            {account.type === "investment" && <><label className="col-span-2 font-body text-xs text-muted-foreground">Assumed annual return (%)<input type="number" min={-100} max={100} step="0.1" className={`${field} mt-1`} value={account.annualReturn ?? 0} onChange={e => update(account.id, { annualReturn: Math.min(100, Math.max(-100, Number.isFinite(+e.target.value) ? +e.target.value : 0)) })}/></label><label className="col-span-2 font-body text-xs text-muted-foreground">Investment overflow weight<input type="number" min={0} max={100} step="0.1" className={`${field} mt-1`} value={account.overflowWeight ?? 100} onChange={e => update(account.id, { overflowWeight: Math.min(100, numeric(e.target.value)) })}/><span className="mt-1 block leading-relaxed">Effective share: {investmentWeight > 0 ? ((account.overflowWeight ?? 100) / investmentWeight * 100).toFixed(1) : "0"}%</span></label></>}
          </>}
        </div>
        {deadline && !account.priority && <div className="mt-4 font-body text-xs leading-relaxed">{deadline.issue ? <p role="alert" className="text-destructive">{deadline.issue}</p> : !complete && <p>Calculated contribution: <b>{currency(deadline.amount)} / month</b> · {deadline.months} {deadline.months === 1 ? "deposit" : "deposits"}</p>}</div>}
        {account.priority && account.type === "savings" && account.goal <= 0 && <p className="mt-3 font-body text-xs text-muted-foreground">Set a goal{account.goalBasis ? " by adding living expenses" : ""} to include this account in automatic funding.</p>}
        {missesDeadline && !complete && <p role="alert" className="mt-3 font-body text-xs text-destructive">Priority funding misses the {targetDateLabel(account.targetDate)} target. {estimatedDate ? `Estimated completion: ${targetDateLabel(estimatedDate)}.` : "This goal is not reached in the forecast."}</p>}
        {account.type !== "other" ? <div className="mt-4 border-t border-dashed border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 font-body text-sm"><span className={complete ? "text-success" : "text-foreground"}>{complete ? <span className="flex items-center gap-1"><Check className="h-4 w-4"/>Goal reached</span> : plan.blocked ? "Adjust allocations to see your plan" : `${currency(contribution.amount)} this month`}</span><span className="text-xs text-muted-foreground">{!complete && account.goal > 0 && (plan.blocked ? "Timeline unavailable" : months === null ? account.type === "investment" ? "Goal not reached within 100 years at these assumptions" : "Set an allocation to reach this goal" : `Goal in ${timeline(months)}`)}</span></div>
          {account.type === "investment" && contribution.overflow > 0 && !plan.blocked && <p className="mt-2 font-body text-xs text-success">Includes {currency(contribution.overflow)} redirected from leftover funds.</p>}
          {account.goal > 0 && <><div role="progressbar" aria-label={`${account.name} goal progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${percent}%` }}/></div><p className="mt-2 font-body text-xs text-muted-foreground">{currency(account.balance)} of {currency(account.goal)} · {Math.round(percent)}%</p></>}
          {complete && <div className="mt-2"><HelpTip label="Funded account behavior">{account.type === "investment" ? "Investment goals are milestones; contributions and growth continue after reaching them." : "Unused contributions fund remaining savings goals, then investments. Lowering the balance below the goal resumes savings contributions."}</HelpTip></div>}
        </div> : <span className="mt-3 block font-body text-xs text-muted-foreground">Tracking only</span>}
      </article>;
  }
  return <section className="mt-10 rounded-sm border border-border bg-card p-5 sm:p-6" aria-labelledby="savings-accounts-title">
    <div className="mb-3 flex items-center gap-2"><Landmark className="h-5 w-5"/><h2 id="savings-accounts-title" className="font-display text-lg">Savings & Investment Accounts</h2><HelpTip label="Savings and investment calculations"><p>{PRIORITY_FUNDING_RULE}</p><p>Percentages use the full amount available after expenses and debt payments. Deadline deposits are calculated from the goal minus the current balance, divided by the month-end deposits available before the deadline, rounded up to a cent. Only the final amount needed is contributed.</p><p>Investment growth compounds monthly at your assumed annual return. Returns vary; fees and taxes are excluded. Savings earn no interest. No bank transfers or trades are made.</p></HelpTip></div>
    <p className="mb-5 font-body text-sm">Available to allocate: <b>{currency(plan.available)} / month</b></p>
    <div className="mb-5 grid grid-cols-2 gap-3 font-body text-xs sm:grid-cols-4">{[["Fixed savings", plan.fixedTotal], ["Remaining", plan.remainder], ["Priority share", plan.priorityBudget], ["Investment minimum", plan.investmentMinimum]].map(([label, amount]) => <div key={label}><p className="text-muted-foreground">{label}</p><b className="mt-1 block text-sm">{currency(+amount)}</b></div>)}</div>
    <form className="mb-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); add(name); }}>
      <input className={`${field} flex-1 min-w-[150px]`} aria-label="New account name" value={name} onChange={e => setName(e.target.value)} placeholder="Name an account" required maxLength={80}/>
      <select aria-label="New account type" className="rounded-sm border border-border bg-background px-3 py-2 font-body text-sm" value={newType} onChange={e => setNewType(e.target.value as typeof newType)}><option value="savings">Savings</option><option value="investment">Investment</option></select>
      <button type="submit" className="flex shrink-0 items-center gap-2 rounded-sm border border-border px-3 py-2 font-body text-sm hover:bg-accent"><Plus className="h-4 w-4"/>Add</button>
    </form>
    <div className="mb-6 flex flex-wrap gap-2">{presets.filter(p => !accounts.some(a => a.name === p)).map(p => <button key={p} onClick={() => add(p, "savings")} className="rounded-sm border border-dashed border-border px-2 py-1 font-body text-xs text-muted-foreground hover:bg-accent">+ {p}</button>)}<button onClick={() => add("Investment portfolio", "investment")} className="rounded-sm border border-dashed border-border px-2 py-1 font-body text-xs text-muted-foreground">+ Investment portfolio</button></div>
    {plan.priorityMode && <div role="status" className="mb-4 flex items-center gap-1 font-body text-xs text-muted-foreground">Priority funding on <HelpTip label="Priority funding">{PRIORITY_FUNDING_RULE}</HelpTip></div>}
    <div className="savings-account-grid space-y-4">{accounts.map((account, i) => !isFundedSavings(account) ? renderAccount(account, i) : null)}</div>
    <FundedGoals goals={accounts.filter(a => isFundedSavings(a)).map(a => ({ id: a.id, name: a.name, balance: a.balance, goal: a.goal }))} renderEditor={id => {
      const index = accounts.findIndex(a => a.id === id);
      return renderAccount(accounts[index], index);
    }}/>

    {removed && <p role="status" className="mt-4 font-body text-sm">Removed {removed.name}. <button className="underline" onClick={() => { onChange([...accounts, removed]); setRemoved(null); }}>Undo removal</button></p>}
    {plan.unallocated > 0 && !plan.blocked && <p role="status" className="mt-4 font-body text-sm text-muted-foreground">{currency(plan.unallocated)} / month is unallocated. Add an investment account or set a positive overflow weight.</p>}
    {plan.overallocated && <p role="alert" className="mt-4 font-body text-sm text-destructive">Fixed savings commitments exceed available money by {currency(plan.excess)}. Choose later deadlines or lower fixed allocations before splitting the remainder.</p>}
    {monthlySavings <= 0 && <p className="mt-4 font-body text-sm text-muted-foreground">You need positive monthly savings to fund these accounts.</p>}
  </section>;
}

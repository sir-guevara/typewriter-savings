export const PRIORITY_FUNDING_RULE = "After fixed savings are funded, two or more unfinished priority goals share 80% of the remainder and investments receive 20%. One unfinished priority goal splits the remainder 50/50 with investments. With none left, the entire remainder goes to investments. Unused priority funds also go to investments.";

export interface SavingsAccount {
  id: string;
  name: string;
  type: "savings" | "investment" | "other";
  annualReturn?: number;
  overflowWeight?: number;
  balance: number;
  mode: "amount" | "percent" | "deadline";
  targetDate?: string;
  goalBasis?: "living-expenses";
  priority?: boolean;
  allocation: number;
  goal: number;
}

export function isFundedSavings(account: SavingsAccount, balance = account.balance) {
  return account.type === "savings" && account.goal > 0 && balance >= account.goal - .000001;
}

export function isEmergencyFund(account: SavingsAccount) {
  return account.goalBasis === "living-expenses" || (account.type === "savings" && account.name.toLowerCase().replace(/[^a-z]/g, "") === "emergencyfund");
}

// Reuse an existing emergency fund, preserving its balance, allocation and deadline.
export function ensureEmergencyFund(accounts: SavingsAccount[], monthlyLivingExpenses: number): SavingsAccount[] {
  const goal = Math.round(Math.max(0, monthlyLivingExpenses) * 100) * 6 / 100;
  const existing = accounts.find(a => a.goalBasis === "living-expenses") ?? accounts.find(isEmergencyFund);
  if (!existing) return [{ id: crypto.randomUUID(), name: "Emergency Fund", type: "savings", balance: 0, mode: "percent", allocation: 0, goal, goalBasis: "living-expenses" }, ...accounts];
  if (existing.goal === goal && existing.type === "savings" && existing.goalBasis === "living-expenses") return accounts;
  return accounts.map(a => a.id === existing.id ? { ...a, type: "savings", goal, goalBasis: "living-expenses" } : a);
}

// Work in cents so allocations and overflow always reconcile to the available pool.
const cents = (value: number) => Math.round((Number.isFinite(value) ? Math.max(0, value) : 0) * 100);
export function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
export function deadlineContribution(account: SavingsAccount, asOf = todayDate()) {
  const remaining = Math.max(0, cents(account.goal) - cents(account.balance));
  if (account.goal > 0 && remaining === 0) return { months: 0, amount: 0, issue: "" };
  if (account.goal <= 0) return { months: 0, amount: 0, issue: account.goalBasis === "living-expenses" ? "Add monthly expenses to calculate the emergency fund goal." : "Enter a savings goal for this deadline." };
  const due = calendarDate(account.targetDate ?? "");
  const start = calendarDate(asOf);
  if (!due || !start) return { months: 0, amount: 0, issue: "Choose a valid reach-by date." };
  if (due < start) return { months: 0, amount: 0, issue: "This deadline has passed. Choose a new date or update the balance." };
  const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
  const months = (due.getUTCFullYear() - start.getUTCFullYear()) * 12 + due.getUTCMonth() - start.getUTCMonth() + (due.getUTCDate() === lastDay ? 1 : 0);
  if (months <= 0) return { months: 0, amount: 0, issue: "No month-end contribution fits before this date. Choose a later date or update the balance after an immediate deposit." };
  return { months, amount: Math.ceil(remaining / months) / 100, issue: "" };
}
export function targetDateLabel(value: string) {
  const date = calendarDate(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date needed";
}
export function savingsPlan(accounts: SavingsAccount[], monthlySavings: number, asOf = todayDate()) {
  const available = cents(monthlySavings);
  const priorityMode = accounts.some(a => a.type === "savings" && a.priority);
  const deadlineIssues: { id: string; message: string }[] = [];
  // Explicit savings commitments are funded first. Priority savings and investments
  // receive the remainder; their stored manual allocation values do not apply.
  const contributions = accounts.map(account => {
    const fixed = account.type === "savings" && !account.priority;
    const deadline = fixed && account.mode === "deadline" ? deadlineContribution(account, asOf) : null;
    if (deadline?.issue) deadlineIssues.push({ id: account.id, message: deadline.issue });
    const requested = !fixed ? 0 : deadline ? cents(deadline.amount) : account.mode === "percent"
      ? Math.round(available * Math.min(100, Math.max(0, account.allocation)) / 100)
      : cents(account.allocation);
    const room = account.type === "savings" && (account.goal > 0 || account.goalBasis === "living-expenses") ? Math.max(0, cents(account.goal) - cents(account.balance)) : Infinity;
    return { id: account.id, requested: requested / 100, amount: Math.min(requested, room) / 100, overflow: 0 };
  });
  const fixedTotal = contributions.reduce((sum, c) => sum + cents(c.amount), 0);
  const overallocated = fixedTotal > available;
  const remainder = overallocated ? 0 : available - fixedTotal;
  const rooms = accounts.map(a => a.type === "savings" && a.priority && a.goal > 0 ? Math.max(0, cents(a.goal) - cents(a.balance)) : 0);
  const priorityCount = rooms.filter(room => room > 0).length;
  const investmentShare = priorityCount > 1 ? 20 : priorityCount === 1 ? 50 : 100;
  const priorityBudget = priorityCount > 1 ? Math.floor(remainder * 4 / 5) : priorityCount === 1 ? Math.floor(remainder / 2) : 0;
  let left = priorityBudget;
  let active = accounts.map((_, i) => i).filter(i => rooms[i] > 0);
  while (left > 0 && active.length > 0) {
    const share = Math.floor(left / active.length), extra = left % active.length;
    let spent = 0;
    active.forEach((i, rank) => {
      const amount = Math.min(rooms[i], share + (rank < extra ? 1 : 0));
      rooms[i] -= amount;
      contributions[i].amount = (cents(contributions[i].amount) + amount) / 100;
      contributions[i].requested = contributions[i].amount;
      spent += amount;
    });
    left -= spent;
    active = active.filter(i => rooms[i] > 0);
  }
  const priorityTotal = priorityBudget - left;
  let remaining = remainder - priorityTotal;
  const recipients = accounts.map((account, i) => ({ i, weight: account.type === "investment" ? Math.max(0, account.overflowWeight ?? 100) : 0 })).filter(item => item.weight > 0);
  const weightTotal = recipients.reduce((sum, item) => sum + item.weight, 0);
  if (remaining > 0 && weightTotal > 0 && deadlineIssues.length === 0) {
    const shares = recipients.map(item => {
      const exact = remaining * item.weight / weightTotal;
      return { ...item, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
    });
    let extra = remaining - shares.reduce((sum, item) => sum + item.cents, 0);
    shares.sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (const share of shares) {
      const amount = share.cents + (extra-- > 0 ? 1 : 0);
      contributions[share.i].overflow = amount / 100;
      contributions[share.i].amount = amount / 100;
    }
    remaining = 0;
  }
  return { priorityCount, investmentShare, fixedTotal: fixedTotal / 100, remainder: remainder / 100, priorityBudget: priorityBudget / 100, priorityTotal: priorityTotal / 100, investmentMinimum: (remainder - priorityBudget) / 100, priorityMode, contributions, available: available / 100, overallocated, excess: Math.max(0, fixedTotal - available) / 100, deadlineIssues, blocked: overallocated || deadlineIssues.length > 0, unallocated: remaining / 100 };
}
export function monthsToGoal(account: SavingsAccount, monthlySavings: number, asOf = todayDate()) {
  if (!account.goal || account.type === "other") return null;
  const remaining = Math.max(0, cents(account.goal) - cents(account.balance));
  if (!remaining) return 0;
  if (account.type === "savings" && account.priority) return projectPortfolio([account], monthlySavings, 0, asOf)?.[0].goalMonths ?? null;
  if (account.type === "savings" && account.mode === "deadline") {
    const deadline = deadlineContribution(account, asOf);
    return deadline.issue || monthlySavings <= 0 ? null : deadline.months;
  }
  const contribution = account.mode === "percent"
    ? Math.round(cents(monthlySavings) * Math.min(100, Math.max(0, account.allocation)) / 100)
    : cents(monthlySavings) > 0 ? cents(account.allocation) : 0;
  if (account.type === "investment") {
    return projectPortfolio([account], monthlySavings, 0, asOf)?.[0].goalMonths ?? null;
  }
  return contribution > 0 ? Math.ceil(remaining / contribution) : null;
}

function investmentMonthlyRate(account: SavingsAccount) {
  const annual = Number.isFinite(account.annualReturn) ? account.annualReturn : 0;
  return Math.min(100, Math.max(-100, annual)) / 1200;
}

// Simulate the whole plan together so freed savings contributions and investment
// growth affect future allocations and goal dates, without changing real balances.
export function monthLabel(value: string) {
  const date = calendarDate(`${value}-01`);
  return date ? date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "Invalid month";
}
export function planStartDate(value: string) {
  return calendarDate(`${value}-01`) ? `${value}-01` : `${todayDate().slice(0, 7)}-01`;
}
export function projectionMonthLabel(value: string, asOf = todayDate()) {
  const selected = calendarDate(`${value}-01`), start = calendarDate(asOf);
  if (!selected || !start) return "Selected month";
  const number = (selected.getUTCFullYear() - start.getUTCFullYear()) * 12 + selected.getUTCMonth() - start.getUTCMonth() + 1;
  return number > 0 ? `${monthLabel(value)} (Month ${number})` : "Selected month";
}
export function projectedGoalDate(months: number | null, asOf = todayDate()) {
  const start = calendarDate(asOf);
  if (!start || months === null) return null;
  return months === 0 ? asOf : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 0)).toISOString().slice(0, 10);
}
export function projectionMonthRange(years: number, asOf = todayDate()) {
  const start = calendarDate(asOf)!;
  const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + Math.max(1, Math.round(years * 12)) - 1, 1));
  return { min: asOf.slice(0, 7), max: last.toISOString().slice(0, 7) };
}
export interface AccountMonth {
  id: string;
  opening: number;
  contribution: number;
  redirected: number;
  growth: number;
  closing: number;
  goalReached: boolean;
  goalReachedThisMonth: boolean;
}
export interface PortfolioMonth {
  month: string;
  accounts: AccountMonth[];
  unallocated: number;
}
function simulatePortfolio(accounts: SavingsAccount[], monthlySavings: number, horizon: number, asOf: string, scanGoals: boolean) {
  const start = calendarDate(asOf);
  if (!start) return null;
  let simulated = accounts.map(account => ({ ...account }));
  const contributed = accounts.map(() => 0);
  const goalMonths: (number | null)[] = accounts.map(account => account.goal > 0 && account.balance >= account.goal ? 0 : null);
  let results = accounts.map(account => ({ value: account.balance, contributed: 0, growth: 0 }));
  let snapshot: PortfolioMonth | null = null;
  for (let month = 1; month <= (scanGoals ? Math.max(horizon, 1200) : horizon); month++) {
    const monthStart = month === 1 ? asOf : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month - 1, 1)).toISOString().slice(0, 10);
    const plan = savingsPlan(simulated, monthlySavings, monthStart);
    if (plan.blocked) return null;
    const entries: AccountMonth[] = [];
    simulated = simulated.map((account, i) => {
      const contribution = plan.contributions[i].amount;
      contributed[i] += contribution;
      const opening = account.balance;
      const grown = Math.max(0, opening * (account.type === "investment" ? 1 + investmentMonthlyRate(account) : 1));
      const balance = grown + contribution;
      const goalReached = account.type !== "other" && account.goal > 0 && balance >= account.goal - .000001;
      if (goalReached && goalMonths[i] === null) goalMonths[i] = month;
      entries.push({ id: account.id, opening, contribution, redirected: plan.contributions[i].overflow, growth: grown - opening, closing: balance, goalReached, goalReachedThisMonth: goalReached && opening < account.goal - .000001 });
      return { ...account, balance };
    });
    if (month === horizon) {
      results = simulated.map((account, i) => ({ value: Math.round(account.balance * 100) / 100, contributed: Math.round(contributed[i] * 100) / 100, growth: Math.round((account.balance - accounts[i].balance - contributed[i]) * 100) / 100 }));
      snapshot = { month: monthStart.slice(0, 7), accounts: entries, unallocated: plan.unallocated };
    }
  }
  return { projections: results.map((result, i) => ({ ...result, goalMonths: goalMonths[i] })), snapshot };
}
export function projectPortfolio(accounts: SavingsAccount[], monthlySavings: number, years: number, asOf = todayDate()) {
  return simulatePortfolio(accounts, monthlySavings, Math.round(Math.min(100, Math.max(0, years)) * 12), asOf, true)?.projections ?? null;
}
export function projectAccountMonth(accounts: SavingsAccount[], monthlySavings: number, month: string, asOf = todayDate()) {
  const start = calendarDate(asOf), selected = calendarDate(`${month}-01`);
  if (!start || !selected) return null;
  const offset = (selected.getUTCFullYear() - start.getUTCFullYear()) * 12 + selected.getUTCMonth() - start.getUTCMonth() + 1;
  if (offset < 1 || offset > 1200) return null;
  return simulatePortfolio(accounts, monthlySavings, offset, asOf, false)?.snapshot ?? null;
}

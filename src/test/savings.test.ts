import { describe, expect, it } from 'vitest';
import { monthsToGoal, projectAccountMonth, projectionMonthRange, ensureEmergencyFund, savingsPlan, projectPortfolio, type SavingsAccount } from '@/lib/savings';
const account = (updates: Partial<SavingsAccount> = {}): SavingsAccount => ({ id: 'emergency', name: 'Emergency fund', type: 'savings', balance: 0, mode: 'percent', allocation: 25, goal: 1000, ...updates });
describe('account plan', () => {
  it('shares the available pool between amounts and percentages', () => {
    const plan = savingsPlan([account(), account({ id: 'gifts', mode: 'amount', allocation: 100 })], 1000);
    expect(plan.contributions.map(c => c.amount)).toEqual([250, 100]);
    expect(plan.unallocated).toBe(650);
  });
  it('caps the final savings contribution and redirects every leftover cent', () => {
    const accounts = [account({ balance: 950 }), account({ id: 'a', type: 'investment', allocation: 0, overflowWeight: 60, goal: 0 }), account({ id: 'b', type: 'investment', allocation: 0, overflowWeight: 40, goal: 0 })];
    expect(savingsPlan(accounts, 1000).contributions.map(c => c.amount)).toEqual([50, 570, 380]);
    expect(savingsPlan(accounts.map((a, i) => i === 0 ? { ...a, balance: 1000 } : a), 1000).contributions.map(c => c.amount)).toEqual([0, 600, 400]);
  });
  it('blocks overspending and excludes tracking-only balances from funding', () => {
    const plan = savingsPlan([account({ goal: 0, mode: 'amount', allocation: 1100 })], 1000);
    expect(plan.excess).toBe(100);
    expect(plan.overallocated).toBe(true);
    expect(projectPortfolio([account({ goal: 0, mode: 'amount', allocation: 1100 })], 1000, 5)).toBeNull();
    expect(savingsPlan([account({ type: 'other' })], 1000).unallocated).toBe(1000);
  });
  it('calculates timelines from current balances and handles no contributions', () => {
    expect(monthsToGoal(account({ balance: 250 }), 1000)).toBe(3);
    expect(monthsToGoal(account(), 0)).toBeNull();
    expect(monthsToGoal(account({ balance: 1000 }), 1000)).toBe(0);
    expect(monthsToGoal(account({ goal: 0 }), 1000)).toBeNull();
  });
  it('normalizes weights and reconciles rounding to the cent', () => {
    const accounts = [1, 2, 3].map(i => account({ id: String(i), type: 'investment', goal: 0, allocation: 0, overflowWeight: 1 }));
    expect(savingsPlan(accounts, 100).contributions.map(c => c.amount)).toEqual([33.34, 33.33, 33.33]);
    expect(savingsPlan(accounts.map(a => ({ ...a, overflowWeight: 0 })), 100).unallocated).toBe(100);
  });
  it('projects redirected contributions and compound growth together', () => {
    const accounts = [account({ goal: 100, mode: 'amount', allocation: 50 }), account({ id: 'invest', type: 'investment', goal: 0, allocation: 0, annualReturn: 12 })];
    const result = projectPortfolio(accounts, 100, 1)!;
    expect(result[0].value).toBe(100);
    expect(result[1].contributed).toBe(1100);
    expect(result[1].value).toBeCloseTo(50 * 1.01 ** 11 + 50 * 1.01 ** 10 + 100 * ((1.01 ** 10 - 1) / .01), 2);
    expect(result[0].goalMonths).toBe(2);
  });
  it('allows negative investment growth and investments to continue after a milestone', () => {
    const investment = account({ type: 'investment', balance: 1000, goal: 1100, allocation: 0, annualReturn: -12, overflowWeight: 0 });
    expect(projectPortfolio([investment], 1000, 1)![0].value).toBeLessThan(1000);
    expect(projectPortfolio([{ ...investment, annualReturn: 12 }], 0, 1)![0].goalMonths).toBe(10);
    expect(savingsPlan([{ ...investment, balance: 1100, overflowWeight: 100 }], 1000).contributions[0].amount).toBe(1000);
  });
});

describe('deadline savings goals', () => {
  const dated = (updates: Partial<SavingsAccount> = {}) => account({ mode: 'deadline', balance: 100, goal: 1100, targetDate: '2027-02-28', ...updates });
  it('calculates month-end deposits from the current balance, rounding up to a cent', () => {
    const plan = savingsPlan([dated()], 1000, '2026-11-21');
    expect(plan.contributions[0].amount).toBe(250);
    expect(monthsToGoal(dated(), 1000, '2026-11-21')).toBe(4);
    expect(savingsPlan([dated({ goal: 1100.01 })], 1000, '2026-11-21').contributions[0].amount).toBe(250.01);
    expect(savingsPlan([dated({ balance: 500 })], 1000, '2026-11-21').contributions[0].amount).toBe(150);
  });
  it('excludes a deadline month when its month-end falls after the deadline', () => {
    expect(savingsPlan([dated({ targetDate: '2027-02-01' })], 1000, '2026-11-21').contributions[0].amount).toBe(333.34);
    expect(savingsPlan([dated({ targetDate: '2028-02-29' })], 1000, '2028-02-01').contributions[0].amount).toBe(1000);
  });
  it('flags missing, past, impossible immediate dates and unfunded deadlines', () => {
    for (const targetDate of ['', '2026-11-20', '2026-11-25', '2027-02-30']) {
      const plan = savingsPlan([dated({ targetDate })], 1000, '2026-11-21');
      expect(plan.blocked).toBe(true);
      expect(plan.deadlineIssues).toHaveLength(1);
      expect(projectPortfolio([dated({ targetDate })], 1000, 5, '2026-11-21')).toBeNull();
    }
    expect(savingsPlan([dated({ goal: 0 })], 1000, '2026-11-21').blocked).toBe(true);
    expect(savingsPlan([dated()], 200, '2026-11-21').excess).toBe(50);
  });
  it('keeps the deadline schedule in forecasts and redirects completed goals to investments', () => {
    const accounts = [dated(), account({ id: 'investment', type: 'investment', allocation: 0, goal: 0 })];
    const projected = projectPortfolio(accounts, 1000, 1, '2026-11-21')!;
    expect(projected[0].goalMonths).toBe(4);
    expect(projected[0].value).toBe(1100);
    expect(projected[1].contributed).toBe(11000);
    expect(projected[1].value).toBe(11000);
    expect(savingsPlan([dated({ balance: 1100, targetDate: '2020-01-01' }), accounts[1]], 1000, '2026-11-21').contributions.map(c => c.amount)).toEqual([0, 1000]);
  });
});

describe('automatic emergency fund', () => {
  it('creates one fund with a six-month goal and avoids duplicates on subsequent updates', () => {
    const accounts = ensureEmergencyFund([], 1234.56);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ name: 'Emergency Fund', type: 'savings', goal: 7407.36, goalBasis: 'living-expenses' });
    expect(ensureEmergencyFund(accounts, 1234.56)).toBe(accounts);
    const updated = ensureEmergencyFund(accounts, 1500);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(accounts[0].id);
    expect(updated[0].goal).toBe(9000);
  });
  it('adopts an existing emergency fund and preserves balances, allocations and dates', () => {
    const existing = account({ name: 'Emergency fund', balance: 500, mode: 'deadline', targetDate: '2027-12-31' });
    const updated = ensureEmergencyFund([existing], 1000);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ ...existing, goal: 6000, goalBasis: 'living-expenses' });
    expect(ensureEmergencyFund([{ ...updated[0], name: 'Safety net' }], 2000)[0]).toMatchObject({ id: existing.id, name: 'Safety net', goal: 12000 });
  });
  it('routes completed contributions to investments and resumes funding if living costs rise', () => {
    const accounts = ensureEmergencyFund([account({ balance: 600, allocation: 50 }), account({ id: 'i', name: 'Investment', type: 'investment', goal: 0, allocation: 0 })], 100);
    expect(savingsPlan(accounts, 1000).contributions.map(c => c.amount)).toEqual([0, 1000]);
    const revised = ensureEmergencyFund(accounts, 200);
    expect(savingsPlan(revised, 1000).contributions.map(c => c.amount)).toEqual([500, 500]);
    const noExpenses = ensureEmergencyFund(accounts, 0);
    expect(savingsPlan(noExpenses, 1000).contributions.map(c => c.amount)).toEqual([0, 1000]);
  });
});

describe('month-by-month account plan', () => {
  const accounts = [account({ balance: 950 }), account({ id: 'i', name: 'Investment', type: 'investment', balance: 0, allocation: 0, goal: 0, annualReturn: 12 })];
  it('shows the final savings deposit, then redirects next month into investments with growth', () => {
    const first = projectAccountMonth(accounts, 1000, '2026-11', '2026-11-21')!;
    expect(first.accounts[0]).toMatchObject({ opening: 950, contribution: 50, closing: 1000, goalReachedThisMonth: true });
    expect(first.accounts[1]).toMatchObject({ opening: 0, contribution: 950, closing: 950 });
    const next = projectAccountMonth(accounts, 1000, '2026-12', '2026-11-21')!;
    expect(next.accounts[0]).toMatchObject({ contribution: 0, closing: 1000, goalReached: true, goalReachedThisMonth: false });
    expect(next.accounts[1]).toMatchObject({ opening: 950, contribution: 1000, growth: 9.5, closing: 1959.5, redirected: 1000 });
    expect(accounts[0].balance).toBe(950);
    expect(accounts[1].balance).toBe(0);
  });
  it('matches the full horizon and respects dates and invalid plans', () => {
    const range = projectionMonthRange(1, '2026-11-21');
    expect(range).toEqual({ min: '2026-11', max: '2027-10' });
    const end = projectAccountMonth(accounts, 1000, range.max, '2026-11-21')!;
    const full = projectPortfolio(accounts, 1000, 1, '2026-11-21')!;
    end.accounts.forEach((a, i) => expect(a.closing).toBeCloseTo(full[i].value, 2));
    expect(projectAccountMonth(accounts, 1000, '2026-10', '2026-11-21')).toBeNull();
    expect(projectAccountMonth(accounts, 1000, '2027-13', '2026-11-21')).toBeNull();
    expect(projectAccountMonth([account({ allocation: 2000, mode: 'amount', goal: 0 })], 1000, '2026-11', '2026-11-21')).toBeNull();
  });
  it('honors deadline deposits before showing the investment-only month', () => {
    const dated = [{ ...accounts[0], mode: 'deadline' as const, targetDate: '2027-02-28', balance: 0 }, accounts[1]];
    expect(projectAccountMonth(dated, 1000, '2027-02', '2026-11-21')!.accounts[0]).toMatchObject({ contribution: 250, goalReachedThisMonth: true });
    expect(projectAccountMonth(dated, 1000, '2027-03', '2026-11-21')!.accounts.map(a => a.contribution)).toEqual([0, 1000]);
  });
});

describe('fixed commitments before the priority split', () => {
  const priority = (id: string, updates: Partial<SavingsAccount> = {}) => account({ id, name: id, goal: 5000, priority: true, allocation: 0, ...updates });
  const investment = account({ id: 'invest', type: 'investment', goal: 0, allocation: 100 });
  it('funds fixed dates, fixed amounts and fixed percentages before dividing the remainder', () => {
    const accounts = [
      account({ id: 'amount', mode: 'amount', allocation: 100, goal: 0 }),
      account({ id: 'percent', allocation: 20, goal: 0 }),
      account({ id: 'date', mode: 'deadline', targetDate: '2026-12-31', goal: 200 }),
      priority('p1'), priority('p2'), investment,
    ];
    const plan = savingsPlan(accounts, 1000, '2026-11-21');
    expect(plan.contributions.map(c => c.amount)).toEqual([100, 200, 100, 240, 240, 120]);
    expect(plan.fixedTotal).toBe(400);
    expect(plan.remainder).toBe(600);
    expect(plan.priorityBudget).toBe(480);
    expect(plan.investmentMinimum).toBe(120);
    expect(plan.blocked).toBe(false);
  });
  it('caps fixed and priority goals and redistributes priority shares while preserving the investment share', () => {
    const accounts = [account({ id: 'fixed', mode: 'amount', allocation: 100, balance: 950 }), priority('p1', { goal: 100 }), priority('p2'), investment];
    expect(savingsPlan(accounts, 1000).contributions.map(c => c.amount)).toEqual([50, 100, 660, 190]);
    const almostDone = [priority('p', { goal: 100 }), investment];
    expect(savingsPlan(almostDone, 1000).contributions.map(c => c.amount)).toEqual([100, 900]);
    expect(savingsPlan([{ ...almostDone[0], balance: 100 }, investment], 1000).contributions.map(c => c.amount)).toEqual([0, 1000]);
  });
  it('allows fixed savings to use more than half and invests the remainder when there are no priorities', () => {
    const plan = savingsPlan([account({ mode: 'amount', allocation: 800 }), investment], 1000);
    expect(plan.blocked).toBe(false);
    expect(plan.contributions.map(c => c.amount)).toEqual([800, 200]);
    expect(plan.investmentMinimum).toBe(200);
  });
  it('never skips a fixed deadline when another account is marked priority', () => {
    const plan = savingsPlan([account({ mode: 'deadline', targetDate: '2020-01-01' }), priority('p'), investment], 1000, '2026-11-21');
    expect(plan.blocked).toBe(true);
    expect(plan.deadlineIssues).toHaveLength(1);
    expect(projectPortfolio([account({ mode: 'amount', allocation: 1100, goal: 0 }), priority('p')], 1000, 1)).toBeNull();
  });
  it('models future freed commitments and interest without changing recorded balances', () => {
    const accounts = [account({ id: 'fixed', mode: 'amount', allocation: 200, goal: 400 }), priority('p', { goal: 1000 }), { ...investment, annualReturn: 12 }];
    const first = projectAccountMonth(accounts, 1000, '2026-11', '2026-11-21')!;
    expect(first.accounts.map(a => a.contribution)).toEqual([200, 640, 160]);
    const third = projectAccountMonth(accounts, 1000, '2027-01', '2026-11-21')!;
    expect(third.accounts.map(a => a.contribution)).toEqual([0, 0, 1000]);
    const fourth = projectAccountMonth(accounts, 1000, '2027-02', '2026-11-21')!;
    expect(fourth.accounts.map(a => a.contribution)).toEqual([0, 0, 1000]);
    expect(fourth.accounts[2].growth).toBeGreaterThan(0);
    expect(accounts.map(a => a.balance)).toEqual([0, 0, 0]);
  });
  it('reconciles odd cents and leaves investment funds unallocated when there is no recipient', () => {
    const plan = savingsPlan([account({ mode: 'amount', allocation: .01, goal: 0 }), priority('p'), investment], .04);
    expect(plan.contributions.map(c => c.amount)).toEqual([.01, .02, .01]);
    const noInvestment = savingsPlan([account({ mode: 'amount', allocation: 100, goal: 0 }), priority('p')], 1000);
    expect(noInvestment.contributions.map(c => c.amount)).toEqual([100, 720]);
    expect(noInvestment.unallocated).toBe(180);
  });
  it('preserves 20% of only the remainder at every priority completion state', () => {
    for (const available of [.03, 1.01, 1000]) {
      for (const balance of [0, 100, 4999, 5000]) {
        const fixed = Math.floor(available * 100 / 3) / 100;
        const plan = savingsPlan([account({ mode: 'amount', allocation: fixed, goal: 0 }), priority('p', { balance }), investment], available);
        expect(plan.blocked).toBe(false);
        expect(Math.round(plan.contributions[2].amount * 100)).toBeGreaterThanOrEqual(Math.ceil(Math.round(plan.remainder * 100) / 5));
        expect(plan.contributions.reduce((sum, c) => sum + Math.round(c.amount * 100), 0)).toBe(Math.round(available * 100));
      }
    }
  });
});

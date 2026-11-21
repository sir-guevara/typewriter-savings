import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { financialReport, debtPayment, createFinancialPDF } from '@/lib/report';
import { expensesToCSV, parseCSV } from '@/lib/csv';
import Index from '@/pages/Index';
import { fireEvent, within } from '@testing-library/react';
import FinancialReport from '@/components/FinancialReport';
import type { SavingsAccount } from '@/lib/savings';
vi.mock('@/components/ExpenseAnalysis', () => ({ default: () => <div>Spending breakdown</div> }));
afterEach(() => { cleanup(); localStorage.clear(); });
const accounts: SavingsAccount[] = [{ id: '1', name: 'Emergency fund', type: 'savings', balance: 950, goal: 1000, mode: 'amount', allocation: 100 }, { id: '2', name: 'Long-term, "portfolio"', type: 'investment', balance: 10000, goal: 50000, mode: 'percent', allocation: 25, annualReturn: 6, overflowWeight: 100 }];
const expenses = [{ id: '1', label: 'Rent', category: 'Housing' as const, amount: 1500 }];
const debts = [{ id: '1', name: 'Loan', balance: 1200, apr: 0, mode: 'months' as const, targetMonths: 12, monthlyPayment: 0 }];
describe('financial report and exports', () => {
  it('reconciles budget, debt, net worth, and allocations using one model', () => {
    const report = financialReport(3000, expenses, debts, accounts, 5);
    expect(debtPayment(debts[0])).toBe(100);
    expect(report.available).toBe(1400);
    expect(report.netWorth).toBe(9750);
    expect(report.plan.contributions.map(c => c.amount)).toEqual([50, 1350]);
    expect(report.projections![0].value).toBe(1000);
  });
  it('renders all finances as a report without editing controls', () => {
    const { container } = render(<FinancialReport report={financialReport(3000, expenses, debts, accounts, 5)}/>);
    expect(screen.getByText('Emergency fund')).toBeInTheDocument();
    expect(screen.getByText('Long-term, "portfolio"')).toBeInTheDocument();
    expect(screen.getByText('Debt plan')).toBeInTheDocument();
    expect(screen.getByText('6%')).toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea, button')).toHaveLength(0);
  });
  it('round-trips the complete plan through CSV and retains legacy imports', () => {
    const parsed = parseCSV(expensesToCSV(expenses, debts, accounts, { income: 3000, years: 10 }));
    expect(parsed.settings).toEqual({ income: 3000, years: 10 });
    expect(parsed.accounts.map(({ id, ...a }) => a)).toEqual(accounts.map(({ id, ...a }) => ({ annualReturn: 0, overflowWeight: 100, ...a })));
    expect(parseCSV(expensesToCSV([], [], [{ ...accounts[0], name: 'Two\nlines, with \"quotes\"' }])).accounts[0].name).toBe('Two\nlines, with \"quotes\"');
    expect(parsed.expenses[0].amount).toBe(1500);
    expect(parsed.debts[0].balance).toBe(1200);
    expect(parseCSV('Label,Category,Amount\nGroceries,Food,200').expenses[0].amount).toBe(200);
    expect(parseCSV('Type,Label,Category,Amount\nUnknown,Ignore,,100').expenses).toHaveLength(0);
  });
});

describe('report and edit views', () => {
  it('opens a read-only report, preserves legacy balances, and persists edits', () => {
    localStorage.setItem('expense-tracker-data', JSON.stringify({ income: 3000, expenses, accounts, debts, years: 5, generalBalance: 75 }));
    const { unmount } = render(<Index/>);
    expect(screen.getByRole('tabpanel').querySelectorAll('input, textarea')).toHaveLength(0);
    expect(screen.getByRole('tabpanel').querySelectorAll('select')).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Inspect a projected month' })).toBeInTheDocument();
    expect(screen.getByText('Previously unassigned balance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Edit plan' }));
    fireEvent.change(screen.getByLabelText('Monthly Income'), { target: { value: '3500' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Financial report' }));
    expect(screen.getByText('$3,500.00')).toBeInTheDocument();
    const persisted = JSON.parse(localStorage.getItem('expense-tracker-data')!);
    expect(persisted.income).toBe(3500);
    expect(persisted.generalBalance).toBeUndefined();
    expect(persisted.accounts.filter((a: SavingsAccount) => a.name === 'Previously unassigned balance')).toHaveLength(1);
    unmount();
    render(<Index/>);
    expect(screen.getAllByText('Previously unassigned balance')).toHaveLength(1);
  });
});

it('creates a complete multipage PDF without dropping accounts, debts, or planning notes', async () => {
  const manyExpenses = Array.from({ length: 50 }, (_, i) => ({ ...expenses[0], id: String(i), label: `Expense ${i + 1}`, amount: 10 }));
  const doc = await createFinancialPDF(financialReport(3000, manyExpenses, debts, accounts, 5));
  const output = doc.output();
  expect(output.startsWith('%PDF-')).toBe(true);
  expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  for (const text of ['Your Financial Plan', 'Expense 50', 'Emergency fund', 'Accounts & goals', 'Debt plan', 'Planning notes']) expect(output).toContain(text);
});

it('includes the deadline and required deposit in the report, PDF model, and CSV round-trip', () => {
  const dated: SavingsAccount = { ...accounts[0], mode: 'deadline', goal: 1100, balance: 100, targetDate: '2027-02-28' };
  const report = financialReport(3000, expenses, debts, [dated], 5, '2026-11-21');
  expect(report.goalLabels[0]).toContain('By Feb 28, 2027');
  expect(report.goalLabels[0]).toContain('$250.00 per month required');
  expect(report.accountRows[0][3]).toBe('$250.00');
  expect(parseCSV(expensesToCSV([], [], [dated])).accounts[0]).toMatchObject({ mode: 'deadline', targetDate: '2027-02-28', goal: 1100 });
  const { container } = render(<FinancialReport report={report}/>);
  expect(screen.getByText(/By Feb 28, 2027/)).toBeInTheDocument();
  expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0);
});

it('creates and persists the emergency fund, updates its goal with expenses, and keeps it automatic after export', () => {
  const { unmount } = render(<Index/>);
  let saved = JSON.parse(localStorage.getItem('expense-tracker-data')!);
  expect(saved.accounts).toHaveLength(1);
  expect(saved.accounts[0]).toMatchObject({ goalBasis: 'living-expenses', goal: 0 });
  fireEvent.click(screen.getByRole('tab', { name: 'Edit plan' }));
  const expenseEditor = screen.getByText('Monthly Expenses').closest('section')!;
  fireEvent.change(within(expenseEditor).getByPlaceholderText('Label'), { target: { value: 'Groceries' } });
  fireEvent.change(within(expenseEditor).getByPlaceholderText('0'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));
  saved = JSON.parse(localStorage.getItem('expense-tracker-data')!);
  expect(saved.accounts[0].goal).toBe(1800);
  fireEvent.change(within(expenseEditor).getByDisplayValue('300'), { target: { value: '500' } });
  saved = JSON.parse(localStorage.getItem('expense-tracker-data')!);
  expect(saved.accounts[0].goal).toBe(3000);
  expect(screen.queryByRole('button', { name: 'Remove Emergency Fund' })).not.toBeInTheDocument();
  const roundTrip = parseCSV(expensesToCSV(saved.expenses, [], saved.accounts));
  expect(roundTrip.accounts[0].goalBasis).toBe('living-expenses');
  fireEvent.click(screen.getByRole('tab', { name: 'Financial report' }));
  expect(screen.getByText(/6 months of expenses: \$3,000.00/)).toBeInTheDocument();
  unmount();
  render(<Index/>);
  expect(JSON.parse(localStorage.getItem('expense-tracker-data')!).accounts).toHaveLength(1);
});

it('lets you inspect a future month and return to the full outlook without editing the plan', async () => {
  function MonthlyReport() {
    const [month, setMonth] = useState('');
    return <FinancialReport report={financialReport(3000, expenses, debts, accounts, 5, '2026-11-21', month)} onMonthChange={setMonth}/>;
  }
  render(<MonthlyReport/>);
  const picker = screen.getByLabelText('Inspect a projected month');
  expect(picker.tagName).toBe('SELECT');
  expect(within(picker).getByRole('option', { name: 'November 2026 (Month 1)' })).toHaveValue('2026-11');
  expect(within(picker).getByRole('option', { name: 'October 2031 (Month 60)' })).toHaveValue('2031-10');
  expect(within(picker).queryByRole('option', { name: /\(Month 0\)/ })).not.toBeInTheDocument();
  expect(within(picker).queryByRole('option', { name: /\(Month 61\)/ })).not.toBeInTheDocument();
  fireEvent.change(picker, { target: { value: '2026-12' } });
  expect(screen.getByText('Your plan for December 2026 (Month 2)')).toBeInTheDocument();
  expect(screen.getByText('Invest this month')).toBeInTheDocument();
  const investmentRow = screen.getByText('Long-term, "portfolio"').closest('tr')!;
  expect(within(investmentRow).getByText('$1,400.00')).toBeInTheDocument();
  expect(within(investmentRow).getByText('$57.00')).toBeInTheDocument();
  expect(within(investmentRow).getByText('$12,857.00')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Funded goals' })).getByText('Funded')).toBeInTheDocument();
  const doc = await createFinancialPDF(financialReport(3000, expenses, debts, accounts, 5, '2026-11-21', '2026-12'));
  expect(doc.output()).toContain('Plan for December 2026');
  expect(doc.output()).toContain('Month 2');
  fireEvent.click(screen.getByRole('button', { name: 'Full outlook' }));
  expect(screen.getByText('Annual growth')).toBeInTheDocument();
  expect(screen.queryByText('Contribute this month')).not.toBeInTheDocument();
  expect(accounts[0].balance).toBe(950);
});

it('exports priority settings and shows missed deadlines without blocking the forecast', () => {
  const priorityAccounts: SavingsAccount[] = [
    { ...accounts[0], name: 'Priority reserve', balance: 0, goal: 1500, priority: true, mode: 'deadline', targetDate: '2026-11-30' },
    { ...accounts[0], id: 'regular', name: 'Vacation', balance: 0, goal: 1000, priority: false },
    accounts[1],
  ];
  const report = financialReport(3000, expenses, debts, priorityAccounts, 5, '2026-11-21');
  expect(report.plan.contributions.map(c => c.amount)).toEqual([1040, 100, 260]);
  expect(report.projections).not.toBeNull();
  expect(report.deadlineWarnings[0]).toContain('misses the Nov 30, 2026 target');
  expect(report.accountRows[0][0]).toBe('Priority reserve (priority)');
  expect(parseCSV(expensesToCSV([], [], priorityAccounts)).accounts[0].priority).toBe(true);
  render(<FinancialReport report={report}/>);
  expect(screen.getByText('Priority reserve · Priority')).toBeInTheDocument();
  expect(screen.getByText(/priority funding misses the Nov 30/)).toBeInTheDocument();
});

it('groups funded savings in green cards while keeping investments and unfinished savings active', () => {
  const fundedAccounts: SavingsAccount[] = [{ ...accounts[0], balance: 1200 }, { ...accounts[0], id: 'vacation', name: 'Vacation', balance: 200 }, { ...accounts[1], goal: 5000 }];
  render(<FinancialReport report={financialReport(3000, expenses, debts, fundedAccounts, 5, '2026-11-21')}/>);
  const funded = screen.getByRole('region', { name: 'Funded goals' });
  expect(funded).toHaveClass('funded-goals');
  expect(within(funded).getByText('Emergency fund')).toBeInTheDocument();
  expect(within(funded).queryByText('Vacation')).not.toBeInTheDocument();
  expect(within(funded).queryByText('Long-term, "portfolio"')).not.toBeInTheDocument();
  expect(screen.getByText('Vacation').closest('tr')).not.toBeNull();
  expect(screen.getByText('Long-term, "portfolio"').closest('tr')).not.toBeNull();
});

it('keeps the final deposit visible when a selected month projects a newly funded savings goal', async () => {
  const report = financialReport(3000, expenses, debts, accounts, 5, '2026-11-21', '2026-11');
  render(<FinancialReport report={report}/>);
  const funded = screen.getByRole('region', { name: 'Funded goals' });
  expect(within(funded).getByText('Funded this month')).toBeInTheDocument();
  expect(within(funded).getByText('$50.00 to contribute this month.')).toBeInTheDocument();
  expect(within(funded).getByText('Projected reserves')).toBeInTheDocument();
  expect(screen.getByText('Emergency fund').closest('tr')).toBeNull();
  const doc = await createFinancialPDF(report);
  expect(doc.output()).toContain('Funded goals - November 2026');
  expect(doc.output()).toContain('Month 1');
});

it('anchors Month 1 to the chosen month and year, including deadline deposits and exports', async () => {
  const dated: SavingsAccount = { id: 'trip', name: 'Trip fund', type: 'savings', balance: 0, goal: 1200, allocation: 0, mode: 'deadline', targetDate: '2027-04-30' };
  localStorage.setItem('expense-tracker-data', JSON.stringify({ income: 3000, expenses, debts: [], accounts: [dated], years: 1, startMonth: '2027-01' }));
  const { unmount } = render(<Index/>);
  fireEvent.click(screen.getByRole('tab', { name: 'Edit plan' }));
  expect(screen.getByLabelText('Month 1 year')).toHaveValue('2027');
  expect(screen.getByLabelText('Month 1 month')).toHaveValue('01');
  fireEvent.change(screen.getByLabelText('Month 1 month'), { target: { value: '02' } });
  const tripEditor = screen.getByDisplayValue('Trip fund').closest('article')!;
  expect(within(tripEditor).getByText('$400.00 / month')).toBeInTheDocument();
  expect(within(tripEditor).getByText('Goal in 3 months')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Financial report' }));
  const picker = screen.getByLabelText('Inspect a projected month');
  expect(within(picker).getByRole('option', { name: 'February 2027 (Month 1)' })).toHaveValue('2027-02');
  expect(within(picker).getByRole('option', { name: 'January 2028 (Month 12)' })).toHaveValue('2028-01');
  fireEvent.change(picker, { target: { value: '2027-03' } });
  expect(screen.getByText('Your plan for March 2027 (Month 2)')).toBeInTheDocument();
  const saved = JSON.parse(localStorage.getItem('expense-tracker-data')!);
  expect(saved.startMonth).toBe('2027-02');
  expect(saved.accounts.find((a: SavingsAccount) => a.id === 'trip').balance).toBe(0);
  const csv = parseCSV(expensesToCSV(saved.expenses, saved.debts, saved.accounts, { income: saved.income, years: saved.years, startMonth: saved.startMonth }));
  expect(csv.settings?.startMonth).toBe('2027-02');
  const pdf = await createFinancialPDF(financialReport(saved.income, saved.expenses, saved.debts, saved.accounts, saved.years, '2027-02-01'));
  expect(pdf.output()).toContain('Month 1: February 2027');
  unmount();
  render(<Index/>);
  expect(screen.getByText(/February 2027 is Month 1/)).toBeInTheDocument();
});

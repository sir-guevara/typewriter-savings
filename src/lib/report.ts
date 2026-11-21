import { PRIORITY_FUNDING_RULE, isFundedSavings, projectedGoalDate, projectPortfolio, projectAccountMonth, projectionMonthRange, projectionMonthLabel, monthLabel, savingsPlan, todayDate, targetDateLabel, deadlineContribution, type SavingsAccount } from './savings';
import type { ExpenseItem } from './types';
import type { DebtItem } from '@/components/DebtTracker';
export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
export function debtPayment(debt: DebtItem) {
  if (debt.mode === 'payment') return debt.monthlyPayment;
  const r = debt.apr / 1200, n = Math.max(1, debt.targetMonths);
  return r === 0 ? debt.balance / n : debt.balance * r / (1 - (1 + r) ** -n);
}
export function goalTime(months: number | null) {
  if (months === null) return 'Not reached at current assumptions';
  if (months === 0) return 'Reached';
  const years = Math.floor(months / 12), rest = months % 12;
  return [years ? `${years}y` : '', rest ? `${rest}mo` : ''].filter(Boolean).join(' ');
}
export function financialReport(income: number, expenses: ExpenseItem[], debts: DebtItem[], accounts: SavingsAccount[], years: number, asOf = todayDate(), selectedMonth = "") {
  const spending = expenses.reduce((sum, e) => sum + e.amount, 0);
  const debtPayments = debts.reduce((sum, d) => sum + debtPayment(d), 0);
  const available = income - spending - debtPayments;
  const plan = savingsPlan(accounts, available, asOf);
  const projections = projectPortfolio(accounts, available, years, asOf);
  const selectedMonthLabel = projectionMonthLabel(selectedMonth, asOf);
  const monthRange = projectionMonthRange(years, asOf);
  const monthPlan = selectedMonth >= monthRange.min && selectedMonth <= monthRange.max ? projectAccountMonth(accounts, available, selectedMonth, asOf) : null;
  const savings = accounts.reduce((sum, a) => sum + (a.type === 'savings' ? a.balance : 0), 0);
  const investments = accounts.reduce((sum, a) => sum + (a.type === 'investment' ? a.balance : 0), 0);
  const tracked = accounts.reduce((sum, a) => sum + (a.type === 'other' ? a.balance : 0), 0);
  const debtBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const weightTotal = accounts.filter(a => a.type === 'investment').reduce((sum, a) => sum + (a.overflowWeight ?? 100), 0);
  const overflowShares = accounts.map(a => a.type === 'investment' && weightTotal > 0 ? (a.overflowWeight ?? 100) / weightTotal * 100 : 0);
  const deadlineWarnings = plan.priorityMode ? accounts.flatMap((a, i) => {
    if (a.type !== 'savings' || !a.priority || a.mode !== 'deadline' || !a.targetDate || a.balance >= a.goal) return [];
    const date = projectedGoalDate(projections?.[i].goalMonths ?? null, asOf);
    return !date || date > a.targetDate ? [`${a.name}: priority funding misses the ${targetDateLabel(a.targetDate)} target.${date ? ` Estimated completion: ${targetDateLabel(date)}.` : ''}`] : [];
  }) : [];
  const goalLabels = accounts.map((a, i) => {
    if (a.goalBasis === 'living-expenses' && a.goal <= 0) return 'Add expenses to calculate the six-month goal';
    if (a.goal <= 0) return a.mode === 'deadline' ? 'Goal needed' : 'Ongoing';
    const status = a.balance >= a.goal ? 'Reached' : goalTime(projections?.[i].goalMonths ?? null);
    if (a.type === 'savings' && a.mode === 'deadline') {
      const deadline = deadlineContribution(a, asOf);
      return `${a.goalBasis === 'living-expenses' ? '6 months of expenses: ' : ''}${money(a.goal)} / By ${targetDateLabel(a.targetDate ?? '')} / ${a.priority ? 'Priority allocation; date is a target' : deadline.issue || `${money(deadline.amount)} per month required`} / ${status}`;
    }
    return `${a.goalBasis === 'living-expenses' ? '6 months of expenses: ' : ''}${money(a.goal)} / ${status}`;
  });
  const accountRows = accounts.map((a, i) => [a.name + (a.priority && a.type === 'savings' ? ' (priority)' : ''), a.type === 'investment' ? `investment / ${overflowShares[i].toFixed(1)}% of overflow` : a.type, money(a.balance), plan.blocked ? 'Adjust plan' : money(plan.contributions[i].amount), goalLabels[i], a.type === 'investment' ? `${a.annualReturn ?? 0}%` : '-', projections ? money(projections[i].value) : 'Unavailable']);
  return { income, expenses, debts, accounts, years, asOf, selectedMonth, selectedMonthLabel, monthRange, monthPlan, spending, debtPayments, available, plan, projections, savings, investments, tracked, debtBalance, netWorth: savings + investments + tracked - debtBalance, overflowShares, deadlineWarnings, goalLabels, accountRows };
}
export type FinancialReportData = ReturnType<typeof financialReport>;
export async function createFinancialPDF(report: FinancialReportData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF();
  doc.setFont('courier', 'bold'); doc.setFontSize(20); doc.text('Your Financial Plan', 14, 20);
  doc.setFont('courier', 'normal'); doc.setFontSize(10); doc.text(`Month 1: ${monthLabel(report.asOf.slice(0, 7))} | ${report.years}-year outlook`, 14, 29);
  let y = 37;
  function table(title: string, head: string[], body: string[][], funded = false) {
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setTextColor(funded ? 40 : 35, funded ? 100 : 35, funded ? 60 : 35);
    doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.text(title, 14, y); doc.setTextColor(35);
    autoTable(doc, { startY: y + 5, head: [head], body, styles: { font: 'courier', fontSize: 8, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: funded ? [40, 100, 60] : [51, 75, 56] }, theme: 'striped', margin: { top: 18, bottom: 18 } });
    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 13;
  }
  table('Monthly cash flow', ['Income', 'Expenses', 'Debt payments', 'Save & invest'], [[report.income, report.spending, report.debtPayments, report.available].map(money)]);
  table('Where you stand', ['Savings', 'Investments', 'Other assets', 'Debt', 'Net worth'], [[report.savings, report.investments, report.tracked, report.debtBalance, report.netWorth].map(money)]);
  table('Expenses', ['Expense', 'Category', 'Monthly'], report.expenses.length ? report.expenses.map(e => [e.label, e.category, money(e.amount)]) : [['No expenses entered', '', '']]);
  const activeRows = report.accountRows.filter((_, i) => !isFundedSavings(report.accounts[i]));
  table('Accounts & goals', ['Account', 'Type', 'Current', '/ month', 'Goal / time', 'Return', `In ${report.years}y`], activeRows.length ? activeRows : [['No active accounts', '', '', '', '', '', '']]);
  const fundedAccounts = report.accounts.filter(a => isFundedSavings(a));
  if (fundedAccounts.length) table('Funded savings goals', ['Account', 'Set aside', 'Goal', 'Status'], fundedAccounts.map(a => [a.name, money(a.balance), money(a.goal), '100% funded']), true);
  if (report.selectedMonth) {
    if (report.monthPlan) {
      const monthlyRows = report.accounts.map((a, i) => ({ account: a, row: report.monthPlan.accounts[i] }));
      const monthlyActive = monthlyRows.filter(({ account, row }) => !isFundedSavings(account, row.closing));
      table(`Plan for ${report.selectedMonthLabel}`, ['Account', 'Start value', 'Contribute', 'Est. growth', 'End value', 'Goal status'], monthlyActive.length ? monthlyActive.map(({ account: a, row }) => [a.name, money(row.opening), money(row.contribution), money(row.growth), money(row.closing), row.goalReached ? 'Milestone reached' : a.goal > 0 ? 'In progress' : 'Ongoing']) : [['No active accounts; see funded goals below', '', '', '', '', '']]);
      const monthlyFunded = monthlyRows.filter(({ account, row }) => isFundedSavings(account, row.closing));
      if (monthlyFunded.length) table(`Funded goals - ${report.selectedMonthLabel}`, ['Account', 'Start value', 'Final deposit', 'End value', 'Status'], monthlyFunded.map(({ account, row }) => [account.name, money(row.opening), money(row.contribution), money(row.closing), row.goalReachedThisMonth ? 'Funded this month' : 'Already funded']), true);
    }
    else table('Selected month', ['Planning action'], [['Adjust your plan or select a month within the projection period to view monthly actions.']]);
  }
  if (report.debts.length) table('Debt plan', ['Debt', 'Balance', 'APR', 'Monthly payment'], report.debts.map(d => [d.name, money(d.balance), `${d.apr}%`, money(debtPayment(d))]));
  const notes = [...report.deadlineWarnings, ...(report.plan.priorityMode ? [`${PRIORITY_FUNDING_RULE} Priority dates are targets; fixed deadlines determine required deposits.`] : []), ...report.plan.deadlineIssues.map(issue => `${report.accounts.find(a => a.id === issue.id)?.name}: ${issue.message}`), report.available < 0 ? `Monthly shortfall: ${money(-report.available)}.` : '', report.plan.overallocated ? `Fixed savings commitments exceed available funds by ${money(report.plan.excess)}. Adjust them before splitting the remainder.` : `Unallocated each month: ${money(report.plan.unallocated)}.`, 'Fixed savings commitments are funded first, with fixed percentages based on the full available monthly amount. The remainder follows the priority-count split: investments receive 20% with two or more unfinished priorities, 50% with one, and 100% with none. Investment goals are milestones, not contribution limits.', 'Deadline savings goals use month-end deposits starting in Month 1, with the final deposit capped at the goal. Projections use available monthly funds, the active allocation rule, and monthly compounding at each investment\'s assumed annual return. Savings have no interest. Returns vary; fees and taxes are excluded. Debt payments remain constant throughout the forecast. Unallocated funds are excluded from projected account values.'].filter(Boolean);
  table('Planning notes', ['Assumptions & actions'], notes.map(note => [note]));
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
    doc.text(`Financial plan | ${page} / ${doc.getNumberOfPages()}`, 14, 289);
  }
  return doc;
}

export async function exportFinancialPDF(report: FinancialReportData) {
  const doc = await createFinancialPDF(report);
  doc.save('financial-plan.pdf');
}

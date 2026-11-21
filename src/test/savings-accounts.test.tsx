import { useState } from 'react';
import { fireEvent, render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SavingsAccounts from '@/components/SavingsAccounts';
import type { SavingsAccount } from '@/lib/savings';
afterEach(() => { cleanup(); vi.useRealTimers(); });
function Planner() {
  const [accounts, setAccounts] = useState<SavingsAccount[]>([{ id: '1', name: 'Emergency fund', type: 'savings', balance: 950, goal: 1000, mode: 'percent', allocation: 25 }]);
  return <SavingsAccounts accounts={accounts} monthlySavings={1000} onChange={setAccounts}/>;
}
describe('account editing', () => {
  it('updates goal progress from actual balances without a general savings account', () => {
    render(<Planner/>);
    expect(screen.getByText('Goal in 1 month')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Current balance ($)'), { target: { value: '1000' } });
    expect(screen.getByText('Goal reached')).toBeInTheDocument();
    expect(screen.queryByText('General Savings')).not.toBeInTheDocument();
    expect(screen.queryByText('Apply one month to balances')).not.toBeInTheDocument();
  });
  it('adds an investment with separate split and growth controls, and can undo removal', () => {
    render(<Planner/>);
    fireEvent.click(screen.getByRole('button', { name: '+ Investment portfolio' }));
    const article = screen.getByDisplayValue('Investment portfolio').closest('article')!;
    fireEvent.change(within(article).getByLabelText('Assumed annual return (%)'), { target: { value: '6' } });
    expect(within(article).getByLabelText('Assumed annual return (%)')).toHaveValue(6);
    expect(within(article).getByText(/Effective share: 100.0%/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Investment portfolio' }));
    expect(screen.queryByDisplayValue('Investment portfolio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo removal' }));
    expect(screen.getByDisplayValue('Investment portfolio')).toBeInTheDocument();
  });
});

it('calculates the contribution when a savings deadline is chosen and updates it with the balance', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 21, 12));
  render(<Planner/>);
  fireEvent.change(screen.getByLabelText('Allocation method'), { target: { value: 'deadline' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid reach-by date');
  fireEvent.change(screen.getByLabelText('Reach by'), { target: { value: '2027-02-28' } });
  expect(screen.getByText('$12.50 / month')).toBeInTheDocument();
  expect(screen.queryByLabelText('Allocation (%)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Current balance ($)'), { target: { value: '900' } });
  expect(screen.getByText('$25.00 / month')).toBeInTheDocument();
});

it('toggles priority funding and recalculates the contribution and timeline', () => {
  render(<Planner/>);
  fireEvent.click(screen.getByLabelText('Priority for Emergency fund'));
  expect(screen.getByText(/Priority funding on/)).toBeInTheDocument();
  expect(screen.getByText('$50.00 this month')).toBeInTheDocument();
  expect(screen.queryByLabelText('Allocation method')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Reach by (optional target)')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Priority for Emergency fund'));
  expect(screen.getByLabelText('Allocation method')).toBeInTheDocument();
});

it('moves savings into the funded group and restores active funding when the balance falls', () => {
  render(<Planner/>);
  fireEvent.change(screen.getByLabelText('Current balance ($)'), { target: { value: '1000' } });
  const funded = screen.getByRole('region', { name: 'Funded goals' });
  expect(within(funded).getByText('Emergency fund')).toBeInTheDocument();
  fireEvent.click(within(funded).getByText('Update account'));
  fireEvent.change(within(funded).getByLabelText('Current balance ($)'), { target: { value: '900' } });
  expect(screen.queryByRole('region', { name: 'Funded goals' })).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('Emergency fund')).toBeInTheDocument();
  expect(screen.getByText('$100.00 this month')).toBeInTheDocument();
});

it('keeps fixed savings controls available while priority funding is on', () => {
  render(<Planner/>);
  fireEvent.click(screen.getByLabelText('Priority for Emergency fund'));
  fireEvent.click(screen.getByRole('button', { name: '+ Vacation' }));
  const vacation = screen.getByDisplayValue('Vacation').closest('article')!;
  expect(within(vacation).getByLabelText('Allocation method')).toBeEnabled();
  fireEvent.change(within(vacation).getByLabelText('Allocation method'), { target: { value: 'amount' } });
  fireEvent.change(within(vacation).getByLabelText('Allocation ($ / month)'), { target: { value: '300' } });
  expect(within(vacation).getByText('$300.00 this month')).toBeInTheDocument();
  expect(screen.getByText('Fixed savings')).toBeInTheDocument();
});

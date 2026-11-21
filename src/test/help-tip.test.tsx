import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import HelpTip from '@/components/HelpTip';
afterEach(cleanup);
const explanation = 'Fixed savings are funded before the remaining funds are split.';
function renderHelp() { return render(<HelpTip label="Funding rules">{explanation}</HelpTip>); }

describe('calculation help', () => {
  it('keeps explanations hidden until tapped and can be dismissed without reopening', () => {
    renderHelp();
    expect(screen.queryByText(explanation)).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'About Funding rules' });
    fireEvent.click(trigger);
    const popup = screen.getByRole('dialog', { name: 'Funding rules' });
    expect(within(popup).getByText(explanation)).toBeInTheDocument();
    fireEvent.click(within(popup).getByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('opens on keyboard focus and closes with Escape', () => {
    renderHelp();
    const trigger = screen.getByRole('button', { name: 'About Funding rules' });
    fireEvent.focus(trigger);
    const popup = screen.getByRole('dialog', { name: 'Funding rules' });
    fireEvent.keyDown(popup, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('opens on hover', () => {
    renderHelp();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'About Funding rules' }));
    expect(screen.getByRole('dialog', { name: 'Funding rules' })).toHaveTextContent(explanation);
  });
});

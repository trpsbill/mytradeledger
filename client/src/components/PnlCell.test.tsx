import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PnlCell } from './PnlCell';

// PnlCell renders a <td>, so mount it inside a table to keep the DOM valid.
function renderCell(props: React.ComponentProps<typeof PnlCell>) {
  return render(
    <table>
      <tbody>
        <tr>
          <PnlCell {...props} />
        </tr>
      </tbody>
    </table>
  );
}

describe('PnlCell', () => {
  it('renders a positive P&L with a + sign, 2 decimals, and the success colour', () => {
    renderCell({ entryType: 'SELL', pnl: '1234.5', pnlStatus: null });
    const cell = screen.getByRole('cell');
    expect(cell).toHaveTextContent('+1,234.50');
    expect(cell).toHaveClass('text-success');
  });

  it('renders a negative P&L with a - sign and the error colour', () => {
    renderCell({ entryType: 'SELL', pnl: '-50', pnlStatus: null });
    const cell = screen.getByRole('cell');
    expect(cell).toHaveTextContent('-50.00');
    expect(cell).toHaveClass('text-error');
  });

  it('renders zero as a positive (+0.00, success)', () => {
    renderCell({ entryType: 'SELL', pnl: '0', pnlStatus: null });
    const cell = screen.getByRole('cell');
    expect(cell).toHaveTextContent('+0.00');
    expect(cell).toHaveClass('text-success');
  });

  it('shows a dash when pnl is null and not an uncomputable SELL', () => {
    renderCell({ entryType: 'BUY', pnl: null, pnlStatus: null });
    expect(screen.getByRole('cell')).toHaveTextContent('-');
  });

  it('shows the warning icon (no number) for an uncomputable SELL', () => {
    renderCell({ entryType: 'SELL', pnl: null, pnlStatus: 'PNL_UNCOMPUTABLE' });
    const cell = screen.getByRole('cell');
    expect(screen.getByLabelText('P&L uncomputable')).toBeInTheDocument();
    // The tooltip carries the explanatory copy
    expect(cell.querySelector('[data-tip]')).toBeTruthy();
  });

  it('applies an extra className passed by the caller', () => {
    renderCell({ entryType: 'SELL', pnl: '10', pnlStatus: null, className: 'extra-class' });
    expect(screen.getByRole('cell')).toHaveClass('extra-class');
  });
});

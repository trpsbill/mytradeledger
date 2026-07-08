import { render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionTimeoutWarning } from './SessionTimeoutWarning';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderWarning(
  secondsUntilExpiry: number,
  onKeepAlive = vi.fn().mockResolvedValue(undefined),
  onLogout = vi.fn()
) {
  const expiresAt = Date.now() + secondsUntilExpiry * 1000;
  return {
    onKeepAlive,
    onLogout,
    ...render(
      <SessionTimeoutWarning
        expiresAt={expiresAt}
        onKeepAlive={onKeepAlive}
        onLogout={onLogout}
      />
    ),
  };
}

describe('SessionTimeoutWarning', () => {
  it('renders the dialog with the initial countdown', () => {
    renderWarning(90); // 1 minute 30 seconds
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/session expiring soon/i)).toBeInTheDocument();
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('shows 0:00 when already at expiry', () => {
    renderWarning(0);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('decrements the countdown every second', () => {
    renderWarning(65); // 1:05
    expect(screen.getByText('1:05')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('1:04')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('"Stay logged in" calls onKeepAlive', async () => {
    const { onKeepAlive } = renderWarning(60);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
    });
    expect(onKeepAlive).toHaveBeenCalledOnce();
  });

  it('"Log out" calls onLogout', () => {
    const { onLogout } = renderWarning(60);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('shows a loading spinner while onKeepAlive is in-flight and disables both buttons', async () => {
    let resolve!: () => void;
    const slowKeepAlive = vi.fn(
      () => new Promise<void>((r) => { resolve = r; })
    );
    renderWarning(60, slowKeepAlive);

    const keepAliveBtn = screen.getByRole('button', { name: /stay logged in/i });
    fireEvent.click(keepAliveBtn);

    // Both buttons disabled while loading
    await act(async () => {}); // flush the state update from the click
    expect(screen.getByRole('button', { name: /log out/i })).toBeDisabled();
    expect(keepAliveBtn).toBeDisabled();
    expect(document.querySelector('.loading')).toBeInTheDocument();

    // Resolve and confirm spinner is gone
    await act(async () => { resolve(); });
    expect(document.querySelector('.loading')).not.toBeInTheDocument();
  });

  it('clamps the countdown to 0 when time has already passed', () => {
    const expiresAt = Date.now() - 5000; // 5 seconds in the past
    render(
      <SessionTimeoutWarning
        expiresAt={expiresAt}
        onKeepAlive={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });
});

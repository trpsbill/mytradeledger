import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, PageNavigator } from './Pagination';

// ─── Pagination ───────────────────────────────────────────────────────────────

function setup(overrides?: Partial<React.ComponentProps<typeof Pagination>>) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <Pagination
      page={1}
      pageSize={50}
      total={200}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...overrides}
    />
  );
  return { onPageChange, onPageSizeChange };
}

describe('Pagination', () => {
  it('shows the correct page and total-pages text', () => {
    setup({ page: 2, pageSize: 50, total: 200 });
    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument();
  });

  it('disables the previous button on the first page', () => {
    setup({ page: 1 });
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables the next button on the last page', () => {
    setup({ page: 4, pageSize: 50, total: 200 });
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('calls onPageChange with page - 1 when previous is clicked', async () => {
    const { onPageChange } = setup({ page: 3 });
    await userEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page + 1 when next is clicked', async () => {
    const { onPageChange } = setup({ page: 2 });
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageSizeChange when the per-page selector changes', async () => {
    const { onPageSizeChange } = setup();
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '25');
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('renders custom pageSizeOptions', () => {
    setup({ pageSizeOptions: [10, 20] });
    const select = screen.getByLabelText('Rows per page');
    expect(select).toHaveTextContent('10');
    expect(select).toHaveTextContent('20');
  });

  it('shows page 1 of 1 when total is 0', () => {
    setup({ page: 1, total: 0 });
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('renders the rows-per-page selector with the current pageSize selected', () => {
    setup({ pageSize: 100, pageSizeOptions: [25, 50, 100] });
    const select = screen.getByLabelText('Rows per page') as HTMLSelectElement;
    expect(select.value).toBe('100');
  });
});

// ─── PageNavigator ────────────────────────────────────────────────────────────

function nav(page: number, total: number, pageSize: number, onPageChange = vi.fn()) {
  render(<PageNavigator page={page} total={total} pageSize={pageSize} onPageChange={onPageChange} />);
  return { onPageChange };
}

describe('PageNavigator', () => {
  it('renders the page and total-pages text', () => {
    nav(3, 350, 50);  // 350/50 = 7 pages
    expect(screen.getByText('Page 3 of 7')).toBeInTheDocument();
  });

  it('disables the previous button on page 1', () => {
    nav(1, 250, 50);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('enables the previous button when page > 1', () => {
    nav(2, 250, 50);
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
  });

  it('disables the next button on the last page', () => {
    nav(5, 250, 50);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('enables the next button when page < totalPages', () => {
    nav(4, 250, 50);
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('calls onPageChange with page - 1 when previous is clicked', async () => {
    const { onPageChange } = nav(4, 250, 50);
    await userEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with page + 1 when next is clicked', async () => {
    const { onPageChange } = nav(4, 250, 50);
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('shows page 1 of 1 and disables both buttons when total fits in one page', () => {
    nav(1, 10, 50);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('shows page 1 of 1 when total is 0', () => {
    nav(1, 0, 50);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });
});

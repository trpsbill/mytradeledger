interface PageNavigatorProps {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PageNavigator({ page, total, pageSize, onPageChange }: PageNavigatorProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost btn-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        ←
      </button>
      <span className="text-sm text-base-content/70 whitespace-nowrap">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        →
      </button>
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
      <div className="flex items-center gap-2 text-sm shrink-0">
        <span className="text-base-content/70 whitespace-nowrap">Rows per page:</span>
        <select
          className="select select-bordered select-xs"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <PageNavigator page={page} total={total} pageSize={pageSize} onPageChange={onPageChange} />
    </div>
  );
}

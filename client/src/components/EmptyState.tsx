interface EmptyStateAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  tooltip?: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

export function EmptyState({ title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-base-content">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-base-content/70">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {action && (
            <button className="btn btn-primary" onClick={action.onClick} disabled={action.loading}>
              {action.loading && <span className="loading loading-spinner loading-sm" />}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <div className={secondaryAction.tooltip ? 'tooltip' : undefined} data-tip={secondaryAction.tooltip}>
              <button className="btn btn-outline" onClick={secondaryAction.onClick} disabled={secondaryAction.loading}>
                {secondaryAction.loading && <span className="loading loading-spinner loading-sm" />}
                {secondaryAction.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
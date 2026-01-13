interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-base-content">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-base-content/70">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <button className="btn btn-primary" onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

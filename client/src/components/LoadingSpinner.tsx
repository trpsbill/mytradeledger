interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg',
  }[size];

  return (
    <div className="flex justify-center items-center p-8">
      <span className={`loading loading-spinner ${sizeClass}`}></span>
    </div>
  );
}

import React from 'react';

interface CalloutProps {
  type: 'info' | 'warning' | 'tip';
  children: React.ReactNode;
}

const CALLOUT_STYLES: Record<CalloutProps['type'], { alertClass: string; icon: React.ReactNode; label: string }> = {
  info: {
    alertClass: 'alert-info',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Note',
  },
  warning: {
    alertClass: 'alert-warning',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5C2.57 18.333 3.532 20 5.072 20z" />
      </svg>
    ),
    label: 'Warning',
  },
  tip: {
    alertClass: 'alert-success',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    label: 'Tip',
  },
};

export function Callout({ type, children }: CalloutProps) {
  const { alertClass, icon, label } = CALLOUT_STYLES[type];
  return (
    <div className={`alert ${alertClass} my-4`}>
      {icon}
      <div className="text-sm">
        <span className="font-semibold">{label}: </span>
        {children}
      </div>
    </div>
  );
}

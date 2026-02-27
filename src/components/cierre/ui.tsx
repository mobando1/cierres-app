import React from 'react';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <h2 className="font-semibold text-foreground mb-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Row({
  label,
  value,
  bold,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted">{label}</span>
      <span
        className={
          highlight
            ? 'text-danger font-medium'
            : negative
              ? 'text-muted'
              : 'text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function Divider() {
  return <div className="border-t border-card-border my-1" />;
}

export function RiesgoBadge({ nivel }: { nivel: string | null }) {
  const styles = {
    OK: 'bg-success-light text-success',
    BAJO: 'bg-warning-light text-warning',
    MEDIO: 'bg-warning-light text-amber-700',
    ALTO: 'bg-danger-light text-danger',
  }[nivel || 'OK'] || 'bg-gray-100 text-muted';

  return (
    <span className={`text-sm font-medium px-3 py-1 rounded-full ${styles}`}>
      {nivel || 'N/A'}
    </span>
  );
}

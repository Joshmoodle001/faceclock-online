import React from 'react';

export function Button({
  children,
  onClick,
  className = '',
  disabled = false,
  variant = 'default',
  size = 'md',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'icon';
}) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
    ghost: 'hover:bg-gray-100 text-gray-600',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    icon: 'p-2',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border rounded-lg shadow-sm ${className}`}>{children}</div>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="p-4 pb-2">{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold">{children}</h3>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="p-4 pt-0 flex justify-end gap-2">{children}</div>;
}

export function Input({
  placeholder,
  value,
  onChange,
  className = '',
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`border rounded-md px-3 py-2 text-sm w-full ${className}`}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium">{children}</label>;
}

export function Badge({
  children,
  variant = 'secondary',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'success' | 'secondary';
  className?: string;
}) {
  const colors = {
    success: 'bg-green-100 text-green-700',
    secondary: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${colors[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 animate-pulse rounded ${className}`} />;
}

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 pt-2">{children}</div>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="hover:bg-gray-50">{children}</tr>;
}

export function TableHead({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase ${className}`}>{children}</th>;
}

export function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

export function Select({
  value,
  onValueChange,
  placeholder,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="border rounded-md px-3 py-2 text-sm bg-white w-full"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}

export function SelectValue({ placeholder }: { placeholder: string }) {
  return <option value="">{placeholder}</option>;
}

export function ScrollArea({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-y-auto ${className}`}>{children}</div>;
}

export function Checkbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className="h-4 w-4 rounded border-gray-300 text-blue-600"
    />
  );
}

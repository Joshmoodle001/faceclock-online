'use client';

import { MapPin } from 'lucide-react';

interface EmployeeStatusMarkerProps {
  name: string;
  status: string;
  accuracy?: number;
  onClick?: () => void;
}

export function EmployeeStatusMarker({ name, status, accuracy, onClick }: EmployeeStatusMarkerProps) {
  const color = status === 'clocked_in' ? '#22c55e' :
                status === 'break' ? '#f59e0b' :
                status === 'suspicious' ? '#ef4444' : '#6b7280';

  const size = 32;
  const fontSize = 13;

  return (
    <div className="relative inline-flex flex-col items-center" onClick={onClick}>
      {accuracy && accuracy > 0 && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: accuracy * 2,
            height: accuracy * 2,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: `${color}1A`,
            border: `1px solid ${color}4D`,
          }}
        />
      )}
      <div
        className="rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform"
        style={{
          width: size,
          height: size,
          background: color,
          fontSize,
        }}
        title={name}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <span className="text-xs mt-1 bg-background/80 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
        {name}
      </span>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface SensitiveInputProps {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  id?:         string;
  className?:  string;
}

export function SensitiveInput({
  value,
  onChange,
  placeholder = '••••••••',
  id,
  className = '',
}: SensitiveInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`admin-input h-9 w-full rounded-md pl-3 pr-9 text-sm ${className}`}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors"
        style={{ color: 'var(--bodhion-text-secondary)' }}
        tabIndex={-1}
        aria-label={visible ? 'Hide' : 'Show'}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default SensitiveInput;

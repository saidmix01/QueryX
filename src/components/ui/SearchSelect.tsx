import { useEffect, useMemo, useRef, useState } from 'react';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SearchSelect({ options, value, onChange, placeholder, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) setHighlight(0);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!listRef.current || !inputRef.current) return;
      if (
        !listRef.current.contains(e.target as Node) &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commitSelection = (idx: number) => {
    const opt = filtered[idx];
    if (opt) {
      onChange(opt.value);
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              commitSelection(highlight);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="input w-full"
          disabled={disabled}
        />
        {value && (
          <div className="text-xs text-dark-muted truncate max-w-[12rem]">
            {options.find((o) => o.value === value)?.label}
          </div>
        )}
      </div>
      {open && !disabled && (
        <div
          ref={listRef}
          className="absolute z-50 mt-2 w-full max-h-48 overflow-auto border border-dark-border rounded bg-dark-surface shadow-lg"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-dark-muted">Sin resultados</div>
          ) : (
            filtered.map((opt, idx) => (
              <button
                key={opt.value}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commitSelection(idx)}
                className={`w-full text-left px-3 py-2 border-b border-dark-border last:border-b-0 ${
                  idx === highlight ? 'bg-dark-hover' : 'hover:bg-dark-hover'
                }`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

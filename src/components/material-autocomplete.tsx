'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface StockOption {
  material_name: string;
  current_stock: number;
  unit: string;
}

/**
 * Input material free-text dengan dropdown material yang sedang punya stok.
 * Jika nama tidak ada di daftar, dibiarkan sebagai material baru.
 */
export function MaterialAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<StockOption[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    createClient()
      .from('material_stocks')
      .select('material_name, current_stock, unit')
      .order('material_name')
      .then(({ data }) => {
        if (mounted && data) setOptions(data as unknown as StockOption[]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.material_name.toLowerCase().includes(q));
  }, [value, options]);

  function select(o: StockOption) {
    onChange(o.material_name);
    setOpen(false);
    setHighlight(-1);
  }

  return (
    <div ref={rootRef} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && highlight >= 0 && filtered[highlight]) {
            e.preventDefault();
            select(filtered[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && filtered.length > 0 ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
          {filtered.map((o, i) => (
            <button
              type="button"
              key={o.material_name}
              onMouseDown={(e) => {
                e.preventDefault();
                select(o);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                i === highlight ? 'bg-accent text-accent-foreground' : ''
              )}
            >
              <span className="truncate">{o.material_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                stok: {o.current_stock} {o.unit}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

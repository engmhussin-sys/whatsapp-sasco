'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface DsCommand {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string;
}

/**
 * لوحة الأوامر على توكنات `ds-*`. تُركَّب داخل `DsShell` وتستقبل أوامر
 * **تابعة للدور** — لا قائمة واحدة مشتركة. تُفتح بـ ⌘K / Ctrl+K وتُغلق
 * بـ Escape أو النقر خارجها.
 *
 * منفصلة عن `CommandPalette.tsx` القديمة (التي تستخدم "brand" و"ink"
 * وتخدم الشاشات الـ34 القائمة) — لا تُحذَف تلك ولا تُعدَّل.
 */
export function DsCommandPalette({
  commands,
  open,
  onOpenChange,
}: {
  commands: DsCommand[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords?.toLowerCase().includes(q));
  }, [commands, query]);

  function go(cmd: DsCommand) {
    onOpenChange(false);
    router.push(cmd.href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[110px]"
      style={{ backgroundColor: 'rgba(23,24,38,.4)', backdropFilter: 'blur(3px)' }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="ds-pop w-[580px] overflow-hidden rounded-[20px] bg-ds-surface shadow-dsDrawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر"
      >
        <div className="flex items-center gap-2.5 border-b border-ds-rowDivider2 px-5 py-4">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-ds-primaryLight text-[11px] text-ds-primaryDarker">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && filtered[activeIndex]) {
                go(filtered[activeIndex]);
              }
            }}
            placeholder="اكتب أمرًا أو ابحث…"
            className="flex-1 bg-transparent text-[15px] text-ds-text outline-none placeholder:text-ds-textDisabled"
          />
          <kbd className="num rounded-md bg-ds-trackBg px-1.5 py-0.5 text-[10px] text-ds-textMuted">ESC</kbd>
        </div>

        <div className="max-h-[340px] overflow-y-auto pb-2.5">
          <p className="px-5 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-[.14em] text-ds-textDisabled">
            إجراءات
          </p>
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-ds-textSecondary">لا نتائج مطابقة</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => go(cmd)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-3 px-5 py-2.5 text-right transition ${
                  i === activeIndex ? 'bg-ds-primaryLight/60' : ''
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-ds-primaryLight text-xs text-ds-primaryDarker">
                  {cmd.icon ?? '◆'}
                </span>
                <span className="flex-1 text-sm text-ds-text">{cmd.label}</span>
                {cmd.shortcut && <span className="num text-[10.5px] text-ds-textDisabled">{cmd.shortcut}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

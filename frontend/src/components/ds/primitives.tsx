'use client';

/**
 * عناصر التصميم المشتركة (Sprint 3+). كلها على توكنات `ds-*` وحدها —
 * لا تستخدم `brand-*`/`ink-*` هنا أبدًا.
 */

import { useEffect } from 'react';

const AVATAR_GRADIENTS = [
  'from-ds-primary to-ds-primaryDark',
  'from-ds-secondary to-ds-secondaryDark',
  'from-ds-coralFrom to-ds-coralTo',
];

export function avatarGradient(index: number): string {
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

export function DsCard({
  children,
  className = '',
  hoverLift = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
}) {
  return (
    <div
      className={`rounded-dsCard border border-ds-cardBorder bg-ds-surface shadow-dsCard transition ${
        hoverLift ? 'hover:-translate-y-0.5 hover:shadow-dsHover' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function DsDarkCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-dsCard bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo text-ds-onDark shadow-dsDarkCard ${className}`}
    >
      {children}
    </div>
  );
}

export type ChipTone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary' | 'secondary';

const CHIP_TONES: Record<ChipTone, string> = {
  success: 'bg-ds-successBg text-ds-successText',
  warning: 'bg-ds-warningBg text-ds-warningText',
  danger: 'bg-ds-dangerBg text-ds-dangerText',
  neutral: 'bg-ds-trackBg text-ds-textMuted',
  primary: 'bg-ds-primaryLight text-ds-primaryDarker',
  secondary: 'bg-ds-secondaryBg text-ds-secondaryText',
};

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-dsPill px-2.5 py-0.5 text-[11.5px] font-medium ${CHIP_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2.5 text-sm font-medium text-white shadow-dsButton transition hover:-translate-y-px disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'neutral' | 'danger';
  className?: string;
}) {
  const toneCls =
    tone === 'danger'
      ? 'border-ds-dangerBorder text-ds-dangerText hover:bg-ds-dangerBg'
      : 'border-ds-fieldBorder text-ds-text hover:border-ds-textDisabled';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-dsField border bg-ds-surface px-4 py-2.5 text-sm transition ${toneCls} ${className}`}
    >
      {children}
    </button>
  );
}

export function DsInput({
  value,
  onChange,
  placeholder,
  ltr = false,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ltr?: boolean;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={ltr ? 'ltr' : undefined}
      className={`rounded-dsField border border-ds-fieldBorder bg-ds-surfaceLight px-3.5 py-2.5 text-sm text-ds-text outline-none transition placeholder:text-ds-textDisabled focus:border-ds-primary focus:bg-ds-surface focus:ring-[3px] focus:ring-ds-primary/15 ${className}`}
    />
  );
}

/** مفتاح تشغيل/إيقاف 42×24 بحركة 0.18s. */
export function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-[42px] shrink-0 rounded-dsPill transition-colors duration-[180ms] ${
        on ? 'bg-ds-primary' : 'bg-ds-trackFillLighter'
      }`}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-[180ms]"
        style={{ insetInlineStart: on ? '3px' : '21px' }}
      />
    </button>
  );
}

/** شرارة 12 عمودًا بارتفاع 32px. */
export function Sparkline({ values, color = 'bg-ds-primary' }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-[3px] ${color}`}
          style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
        />
      ))}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  icon,
  tone = 'primary',
  spark,
  sparkColor,
  deltaLabel,
  deltaTone,
  footnote = 'مقارنة بالشهر الماضي',
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  tone?: ChipTone;
  spark?: number[];
  sparkColor?: string;
  deltaLabel?: string | null;
  deltaTone?: 'success' | 'danger';
  footnote?: string;
}) {
  return (
    <DsCard hoverLift className="p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${CHIP_TONES[tone]}`}>
          {icon}
        </span>
        <span className="flex-1 text-[12.5px] text-ds-textSecondary">{label}</span>
      </div>
      <div className="mb-3.5 flex items-baseline gap-1.5">
        <span className="num text-[30px] font-semibold leading-none text-ds-text">{value}</span>
        {unit && <span className="text-[11.5px] text-ds-textMuted">{unit}</span>}
      </div>
      {spark && <Sparkline values={spark} color={sparkColor} />}
      {deltaLabel && (
        <div className="mt-3 flex items-center gap-2">
          <Chip tone={deltaTone === 'danger' ? 'danger' : 'success'} className="num">
            {deltaLabel}
          </Chip>
          <span className="text-[11.5px] text-ds-textMuted">{footnote}</span>
        </div>
      )}
    </DsCard>
  );
}

/** شريط تقدّم 6px. */
export function Meter({ label, valueLabel, percent, color = 'bg-ds-primary' }: { label: string; valueLabel: string; percent: number; color?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline">
        <span className="flex-1 text-[13px] text-ds-text">{label}</span>
        <span className="num text-xs text-ds-textSecondary">{valueLabel}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[4px] bg-ds-trackBg">
        <div className={`h-full rounded-[4px] ${color}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
}

export type UptimeDay = 'ok' | 'degraded' | 'incident';

export function UptimeStrip({ days, height = 26 }: { days: UptimeDay[]; height?: number }) {
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {days.map((d, i) => (
        <div
          key={i}
          className={`flex-1 rounded-[3px] ${
            d === 'incident' ? 'bg-ds-danger' : d === 'degraded' ? 'bg-ds-warning' : 'bg-ds-successBg'
          }`}
          style={{ height }}
        />
      ))}
    </div>
  );
}

/** لوح جانبي ينزلق من اليسار (RTL) بحواف 22px. */
export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(23,24,38,.34)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <aside
        className="ds-slide fixed bottom-3.5 top-3.5 z-40 flex w-[440px] flex-col overflow-hidden rounded-[22px] bg-ds-surface shadow-dsDrawer"
        style={{ insetInlineStart: '14px' }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </aside>
    </>
  );
}

/** شريط خطوات المعالج. */
export function StepBar({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep: (n: number) => void;
}) {
  return (
    <DsCard className="flex items-center gap-3 px-5 py-4">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = current > n;
        const active = current === n;
        return (
          <div key={label} className="flex flex-1 items-center gap-3">
            <button type="button" onClick={() => onStep(n)} className="flex items-center gap-2.5 text-right">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold transition ${
                  active
                    ? 'bg-gradient-to-br from-ds-primary to-ds-primaryDark text-white shadow-dsButton'
                    : done
                      ? 'bg-ds-successBg text-ds-successText'
                      : 'bg-ds-trackBg text-ds-textMuted'
                }`}
              >
                <span className="num">{n}</span>
              </span>
              <span
                className={`whitespace-nowrap text-[13px] ${
                  active ? 'font-semibold text-ds-text' : done ? 'text-ds-textSecondary' : 'text-ds-textMuted'
                }`}
              >
                {label}
              </span>
            </button>
            {n < steps.length && <span className={`h-0.5 min-w-3.5 flex-1 ${done ? 'bg-ds-success/40' : 'bg-ds-cardBorder'}`} />}
          </div>
        );
      })}
    </DsCard>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ds-text">{title}</p>
      {hint && <p className="text-[12.5px] text-ds-textSecondary">{hint}</p>}
      {action}
    </div>
  );
}

/** هياكل عظمية — الحالة المطلوبة أثناء التحميل (لا سبنر). */
export function SkeletonRows({ rows = 5, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-dsCardInner bg-ds-trackBg" style={{ height }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, height = 148 }: { count?: number; height?: number }) {
  return (
    <div className="grid grid-cols-4 gap-[14px]" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-dsCard bg-ds-trackBg" style={{ height }} />
      ))}
    </div>
  );
}

/** تنبيه صريح بأن ما يُعرَض مشتقّ محليًا لأن نقطة النهاية غير جاهزة. */
export function DerivedDataNotice({ endpoint }: { endpoint: string }) {
  return (
    <div className="rounded-dsField border border-ds-warningBorder bg-ds-warningBg px-4 py-3 text-[12.5px] text-ds-warningText">
      البيانات المعروضة <strong>مشتقّة محليًا</strong> من خطة الشركة لأن <code className="num">{endpoint}</code> غير
      متاحة بعد على الخادم — الحفظ معطّل حتى تُنشأ.
    </div>
  );
}

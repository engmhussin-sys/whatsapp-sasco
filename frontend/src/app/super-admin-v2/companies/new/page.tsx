'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { companiesApi } from '@/lib/api/companies';
import { modulesApi, ModuleCatalogEntry } from '@/lib/api/modules';
import { ErrorBanner } from '@/components/ErrorBanner';

const STEPS = ['بيانات الشركة', 'القطاع', 'الخطة والمقاعد', 'الوحدات', 'المراجعة'];

const PLANS: { code: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'; label: string; seatPrice: number }[] = [
  { code: 'BASIC', label: 'أساسية', seatPrice: 12 },
  { code: 'PROFESSIONAL', label: 'نمو', seatPrice: 22 },
  { code: 'ENTERPRISE', label: 'مؤسسية', seatPrice: 38 },
];

const SEAT_OPTIONS = [50, 150, 300, 500, 1000];

// Sprint 4 scope note: the full 7-level configurable org taxonomy (see
// design's `taxonomy` screen) is Sprint 6 work — this step deliberately
// stays a simple free-text industry field for now rather than a fake
// preset picker with no real backing data behind it yet.
const INDUSTRIES = ['وقود ومحطات', 'رعاية صحية', 'إنشاءات', 'نقل ولوجستيات', 'تجزئة', 'تصنيع', 'أخرى'];

export default function CompanyWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<ModuleCatalogEntry[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    defaultLanguage: 'ar',
    industry: INDUSTRIES[0],
    plan: 'BASIC' as 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE',
    seats: 50,
    moduleCodes: [] as string[],
  });

  useEffect(() => {
    modulesApi
      .getCatalog()
      .then((cat) => {
        setCatalog(cat);
        // Pre-select every non-roadmap module by default — matches the
        // design's own intent that a new company starts with sensible
        // core coverage, not an empty module list.
        setForm((f) => ({ ...f, moduleCodes: cat.filter((m) => !m.isComingSoon).map((m) => m.code) }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل كتالوج الوحدات'));
  }, []);

  const seatPrice = PLANS.find((p) => p.code === form.plan)?.seatPrice ?? 0;
  const addOnPrice = form.plan === 'ENTERPRISE' ? 1800 : 900;
  const liveCatalog = catalog?.filter((m) => !m.isComingSoon) ?? [];
  // Simple heuristic matching the backend's PLAN_INCLUDED_MODULES for a
  // live preview — the backend remains the source of truth at submit time.
  const planIncludedCounts: Record<string, number> = { BASIC: 5, PROFESSIONAL: 9, ENTERPRISE: liveCatalog.length };
  const includedCount = planIncludedCounts[form.plan] ?? 0;
  const paidModuleCount = Math.max(0, form.moduleCodes.length - includedCount);
  const monthlyTotal = seatPrice * form.seats + paidModuleCount * addOnPrice;

  function toggleModule(code: string) {
    setForm((f) => ({
      ...f,
      moduleCodes: f.moduleCodes.includes(code) ? f.moduleCodes.filter((c) => c !== code) : [...f.moduleCodes, code],
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const company = await companiesApi.create({
        name: form.name,
        slug: form.slug,
        industry: form.industry,
        defaultLanguage: form.defaultLanguage,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        plan: form.plan,
        seats: form.seats,
        moduleCodes: form.moduleCodes,
      });
      router.push(`/super-admin/companies/${company.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء الشركة');
      setSubmitting(false);
    }
  }

  const canProceed =
    step === 0 ? form.name.length >= 2 && form.slug.length >= 2 && form.adminEmail && form.adminPassword.length >= 8 && form.adminFirstName && form.adminLastName : true;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-[18px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إضافة شركة جديدة</h1>

      {/* ---- Step indicator ---- */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold num ${
                i === step
                  ? 'bg-gradient-to-br from-ds-primary to-ds-primaryDark text-white shadow-dsButton'
                  : i < step
                    ? 'bg-ds-successBg text-ds-successText'
                    : 'bg-ds-trackBg text-ds-textMuted'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1.5 h-0.5 flex-1 ${i < step ? 'bg-ds-secondaryDark' : 'bg-ds-trackBg'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm font-medium text-ds-textSecondary">{STEPS[step]}</p>

      {error && <ErrorBanner message={error} />}

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-6 shadow-dsCard">
        {step === 0 && (
          <div className="flex flex-col gap-3">
            <Field label="اسم الشركة" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="المُعرِّف (slug)" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} dir="ltr" />
            <Field
              label="بريد مدير الشركة"
              value={form.adminEmail}
              onChange={(v) => setForm({ ...form, adminEmail: v })}
              dir="ltr"
              type="email"
            />
            <Field
              label="كلمة مرور مدير الشركة (8 أحرف على الأقل)"
              value={form.adminPassword}
              onChange={(v) => setForm({ ...form, adminPassword: v })}
              dir="ltr"
              type="password"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="الاسم الأول للمدير" value={form.adminFirstName} onChange={(v) => setForm({ ...form, adminFirstName: v })} />
              <Field label="الاسم الأخير للمدير" value={form.adminLastName} onChange={(v) => setForm({ ...form, adminLastName: v })} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2.5">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                onClick={() => setForm({ ...form, industry: ind })}
                className={`rounded-dsCardInner border p-3 text-right text-sm transition ${
                  form.industry === ind
                    ? 'border-ds-primary bg-ds-primaryLight font-medium text-ds-primaryDarker'
                    : 'border-ds-fieldBorder text-ds-textSecondary hover:border-ds-primaryLightBorder'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2.5">
              {PLANS.map((p) => (
                <button
                  key={p.code}
                  onClick={() => setForm({ ...form, plan: p.code })}
                  className={`rounded-dsCardInner p-4 text-center transition ${
                    form.plan === p.code
                      ? 'bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo text-white shadow-dsDarkCard'
                      : 'border border-ds-fieldBorder text-ds-text hover:border-ds-primaryLightBorder'
                  }`}
                >
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className={`num mt-1 text-lg font-semibold ${form.plan === p.code ? 'text-white' : 'text-ds-primary'}`}>
                    {p.seatPrice} ر.س
                  </p>
                  <p className={`text-[11px] ${form.plan === p.code ? 'text-ds-onDarkSecondary' : 'text-ds-textMuted'}`}>لكل مقعد/شهر</p>
                </button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm text-ds-textSecondary">عدد المقاعد</p>
              <div className="flex flex-wrap gap-2">
                {SEAT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, seats: s })}
                    className={`num rounded-dsPill px-4 py-1.5 text-sm transition ${
                      form.seats === s ? 'bg-ds-primary text-white' : 'bg-ds-trackBg text-ds-textSecondary hover:bg-ds-primaryLight'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="num text-sm font-semibold text-ds-primary">
              الإجمالي الشهري: {monthlyTotal.toLocaleString('en')} ر.س
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {liveCatalog.map((m) => {
                const selected = form.moduleCodes.includes(m.code);
                return (
                  <button
                    key={m.code}
                    onClick={() => toggleModule(m.code)}
                    className={`rounded-dsCardInner border p-3 text-right text-xs transition ${
                      selected ? 'border-ds-primaryLightBorder bg-ds-primaryLight' : 'border-ds-fieldBorder'
                    }`}
                  >
                    <p className="font-medium text-ds-text">{m.nameAr}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-2 text-sm">
            <ReviewRow label="الشركة" value={form.name} />
            <ReviewRow label="القطاع" value={form.industry} />
            <ReviewRow label="الخطة" value={PLANS.find((p) => p.code === form.plan)?.label ?? ''} />
            <ReviewRow label="المقاعد" value={String(form.seats)} />
            <ReviewRow label="الوحدات المُفعَّلة" value={String(form.moduleCodes.length)} />
            <ReviewRow label="الإجمالي الشهري" value={`${monthlyTotal.toLocaleString('en')} ر.س`} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-dsField px-4 py-2 text-sm text-ds-textSecondary disabled:opacity-40"
        >
          رجوع
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canProceed}
            className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-5 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-40"
          >
            متابعة
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-5 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-40"
          >
            {submitting ? 'جارٍ الإنشاء...' : 'إنشاء الشركة'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  dir,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: 'ltr' | 'rtl';
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ds-textMuted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        className="w-full rounded-dsField border border-ds-fieldBorder bg-ds-surface px-3 py-2 text-sm text-ds-text focus:border-ds-primary focus:outline-none"
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ds-rowDivider py-2">
      <span className="text-ds-textMuted">{label}</span>
      <span className="num font-medium text-ds-text">{value}</span>
    </div>
  );
}

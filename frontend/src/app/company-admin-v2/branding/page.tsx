'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import type { Company } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function BrandingSettingsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [company, setCompany] = useState<Company | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryHex, setPrimaryHex] = useState('#0C7C42');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    companiesApi
      .get(companyId)
      .then((c) => {
        setCompany(c);
        setLogoUrl(c.brandLogoUrl ?? '');
        setPrimaryHex(c.brandPrimaryHex ?? '#0C7C42');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الإعدادات'));
  }, [companyId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await companiesApi.update(companyId, { brandLogoUrl: logoUrl || undefined, brandPrimaryHex: primaryHex });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  }

  if (error && !company) return <ErrorBanner message={error} />;
  if (!company) return <Loading />;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">العلامة التجارية</h1>
      <p className="text-sm text-ds-textSecondary">
        خصِّص شعار شركتك ولونها الأساسي داخل المنصة — مستقل تمامًا عن أي شركة أخرى مشتركة في نفس المنصة.
      </p>
      {error && <ErrorBanner message={error} />}
      {saved && <div className="rounded-dsCardInner bg-ds-successBg px-3 py-2 text-sm text-ds-successText">تم حفظ العلامة التجارية</div>}

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <div className="mb-4">
          <label className="mb-1 block text-xs text-ds-textMuted">رابط الشعار</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            dir="ltr"
            placeholder="https://..."
            className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">اللون الأساسي</label>
          <div className="flex items-center gap-2">
            <input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="h-9 w-9 rounded-dsField border border-ds-fieldBorder" />
            <input
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value)}
              dir="ltr"
              className="num flex-1 rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            />
          </div>
        </div>

        {/* ---- Live preview ---- */}
        <div className="mt-5 flex items-center gap-2.5 rounded-dsCardInner bg-ds-sidebarFrom p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white p-1">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={company.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm font-bold" style={{ color: primaryHex }}>
                {company.name[0]}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white">{company.name}</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-dsField px-5 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
          style={{ background: primaryHex }}
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ العلامة التجارية'}
        </button>
      </div>
    </div>
  );
}

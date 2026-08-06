'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Company } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function CompanySettingsV2Page() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [singularEn, setSingularEn] = useState('');
  const [pluralEn, setPluralEn] = useState('');
  const [singularAr, setSingularAr] = useState('');
  const [pluralAr, setPluralAr] = useState('');

  useEffect(() => {
    if (!user?.companyId) return;
    companiesApi
      .get(user.companyId)
      .then((c) => {
        setCompany(c);
        setSingularEn(c.orgUnitLabelSingularEn);
        setPluralEn(c.orgUnitLabelPluralEn);
        setSingularAr(c.orgUnitLabelSingularAr);
        setPluralAr(c.orgUnitLabelPluralAr);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات الشركة'))
      .finally(() => setLoading(false));
  }, [user?.companyId]);

  async function handleSave() {
    if (!user?.companyId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await companiesApi.update(user.companyId, {
        orgUnitLabelSingularEn: singularEn.trim(),
        orgUnitLabelPluralEn: pluralEn.trim(),
        orgUnitLabelSingularAr: singularAr.trim(),
        orgUnitLabelPluralAr: pluralAr.trim(),
      });
      setCompany(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-[14px]">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إعدادات الشركة</h1>
        <p className="mt-1 text-sm text-ds-textSecondary">
          خصِّص المصطلحات لتناسب قطاعك — البيانات الفعلية (المحطات/المواقع الحالية) لا تتأثر، فقط التسمية المعروضة في الواجهات.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {saved && <div className="rounded-dsCardInner bg-ds-successBg px-3 py-2 text-sm text-ds-successText">تم الحفظ بنجاح</div>}

      <div className="flex flex-col gap-5 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <h2 className="font-semibold text-ds-text">تسمية الوحدة التنظيمية</h2>
        <p className="text-xs text-ds-textMuted">
          أمثلة حسب القطاع: &quot;محطة&quot; لشركات الوقود، &quot;مستشفى&quot;/&quot;عيادة&quot; للقطاع الصحي، &quot;موقع&quot;/&quot;مشروع&quot; لشركات المقاولات، &quot;فرع&quot; لسلاسل التجزئة.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: 'الاسم المفرد (عربي)', value: singularAr, set: setSingularAr, placeholder: 'محطة' },
            { label: 'الاسم الجمع (عربي)', value: pluralAr, set: setPluralAr, placeholder: 'محطات' },
            { label: 'Singular (English)', value: singularEn, set: setSingularEn, placeholder: 'Station' },
            { label: 'Plural (English)', value: pluralEn, set: setPluralEn, placeholder: 'Stations' },
          ].map((f) => (
            <div key={f.label}>
              <label className="mb-1 block text-xs text-ds-textMuted">{f.label}</label>
              <input
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !singularAr.trim() || !pluralAr.trim() || !singularEn.trim() || !pluralEn.trim()}
          className="w-fit rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-5 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {company && (
        <p className="text-xs text-ds-textDisabled">
          مثال حيّ: ستظهر صفحة &quot;{company.orgUnitLabelPluralAr}&quot; في القائمة الجانبية بدل &quot;المحطات&quot; المُثبَّتة سابقًا.
        </p>
      )}
    </div>
  );
}

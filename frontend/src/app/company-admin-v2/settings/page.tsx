'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { languagesApi, type Language } from '@/lib/api/languages';
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

  // إدارة اللغات — قسم جديد، منفصل تماماً عن حفظ تسمية الوحدة
  // التنظيمية أعلاه (حالة حفظ/خطأ مستقلة، حتى لا يتداخل فشل أحدهما
  // مع رسائل نجاح/خطأ الآخر).
  const [allLanguages, setAllLanguages] = useState<Language[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<Set<string>>(new Set());
  const [langLoading, setLangLoading] = useState(true);
  const [langError, setLangError] = useState<string | null>(null);
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());
  const [enablingAll, setEnablingAll] = useState(false);

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

  function loadLanguages() {
    if (!user?.companyId) return;
    setLangLoading(true);
    setLangError(null);
    Promise.all([languagesApi.listAll(), languagesApi.listCompanyLanguages(user.companyId)])
      .then(([all, enabled]) => {
        setAllLanguages(all);
        setEnabledCodes(new Set(enabled.map((e) => e.langCode)));
      })
      .catch((err) => setLangError(err instanceof ApiError ? err.message : 'تعذّر جلب قائمة اللغات'))
      .finally(() => setLangLoading(false));
  }

  useEffect(loadLanguages, [user?.companyId]);

  async function toggleLanguage(langCode: string, enable: boolean) {
    if (!user?.companyId || pendingCodes.has(langCode)) return;
    const previous = new Set(enabledCodes);
    const next = new Set(enabledCodes);
    if (enable) next.add(langCode);
    else next.delete(langCode);
    setEnabledCodes(next); // تفاؤلي — يتراجع أدناه إن فشل الخادم
    setPendingCodes((p) => new Set(p).add(langCode));
    setLangError(null);
    try {
      if (enable) await languagesApi.enable(user.companyId, langCode);
      else await languagesApi.disable(user.companyId, langCode);
    } catch (err) {
      setEnabledCodes(previous);
      setLangError(err instanceof ApiError ? err.message : 'تعذّر تحديث اللغة');
    } finally {
      setPendingCodes((p) => {
        const n = new Set(p);
        n.delete(langCode);
        return n;
      });
    }
  }

  /** تفعيل كل اللغات المتاحة دفعة واحدة — للتجربة السريعة. */
  async function enableAllLanguages() {
    if (!user?.companyId) return;
    setEnablingAll(true);
    setLangError(null);
    const toEnable = allLanguages.filter((l) => !enabledCodes.has(l.code));
    const results = await Promise.allSettled(toEnable.map((l) => languagesApi.enable(user.companyId!, l.code)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) setLangError(`تعذّر تفعيل ${failed} من ${toEnable.length} لغة — راجع القائمة أدناه`);
    setEnablingAll(false);
    loadLanguages(); // إعادة جلب الحالة الفعلية من الخادم بدل الاعتماد على التفاؤل هنا
  }

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

      <div className="flex flex-col gap-4 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ds-text">اللغات المُفعَّلة</h2>
            <p className="mt-1 text-xs text-ds-textMuted">
              فقط اللغات المُفعَّلة هنا يصل إليها العمال مُترجَمة — تفضيل اللغة الشخصي لأي فرد لا يكفي وحده.
            </p>
          </div>
          <button
            onClick={enableAllLanguages}
            disabled={enablingAll || langLoading || allLanguages.length === enabledCodes.size}
            className="w-fit shrink-0 rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
          >
            {enablingAll ? 'جارٍ التفعيل...' : 'تفعيل كل اللغات (للتجربة)'}
          </button>
        </div>

        {langError && <ErrorBanner message={langError} />}

        {langLoading ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allLanguages.map((lang) => {
              const isEnabled = enabledCodes.has(lang.code);
              const isPending = pendingCodes.has(lang.code);
              return (
                <label
                  key={lang.code}
                  className="flex cursor-pointer items-center justify-between rounded-dsCardInner border border-ds-cardBorder px-3 py-2"
                >
                  <span className="text-sm text-ds-text">
                    {lang.nativeName} <span className="text-xs text-ds-textMuted">({lang.name})</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={isPending}
                    onChange={(e) => toggleLanguage(lang.code, e.target.checked)}
                    className="h-4 w-4 accent-ds-primary disabled:opacity-50"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

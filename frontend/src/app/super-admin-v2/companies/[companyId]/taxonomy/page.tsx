'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { companiesApi, TaxonomyLevel } from '@/lib/api/companies';
import type { Company } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function TaxonomyPage() {
  const params = useParams();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [presets, setPresets] = useState<{ code: string; nameAr: string; levels: TaxonomyLevel[] }[] | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('fuel');
  const [levels, setLevels] = useState<TaxonomyLevel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([companiesApi.get(companyId), companiesApi.getIndustryPresets(), companiesApi.getTaxonomy(companyId)])
      .then(([c, p, t]) => {
        setCompany(c);
        setPresets(p);
        setSelectedPreset(t.presetCode === 'custom' ? p[0].code : t.presetCode);
        setLevels(t.levels);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل بيانات الهيكل التنظيمي'));
  }, [companyId]);

  function applyPreset(code: string) {
    setSelectedPreset(code);
    const preset = presets?.find((p) => p.code === code);
    if (preset) setLevels(preset.levels);
  }

  function updateLevelLabel(index: number, field: 'labelSingularAr' | 'labelPluralAr', value: string) {
    setLevels((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await companiesApi.updateTaxonomy(companyId, { presetCode: selectedPreset, levels });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الهيكل التنظيمي');
    } finally {
      setSaving(false);
    }
  }

  if (error && !presets) return <ErrorBanner message={error} />;
  if (!company || !presets) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">هيكل المؤسسة — {company.name}</h1>
      {error && <ErrorBanner message={error} />}
      {saved && (
        <div className="rounded-dsCardInner bg-ds-successBg px-3 py-2 text-sm text-ds-successText">
          تم حفظ هيكل المؤسسة بنجاح
        </div>
      )}

      {/* ---- Sector preset picker ---- */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.code}
            onClick={() => applyPreset(p.code)}
            className={`rounded-dsPill px-3.5 py-1.5 text-xs font-medium transition ${
              selectedPreset === p.code ? 'bg-ds-primary text-white' : 'bg-ds-trackBg text-ds-textSecondary hover:bg-ds-primaryLight'
            }`}
          >
            {p.nameAr}
          </button>
        ))}
      </div>

      {/* ---- Level chain ---- */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2">
        {levels.map((l, i) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <div
              className={`shrink-0 rounded-dsPill px-3 py-1.5 text-xs font-medium ${
                i === 0
                  ? 'bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo text-white'
                  : i <= 3
                    ? 'bg-ds-primaryLight text-ds-primaryDarker'
                    : 'bg-ds-trackBg text-ds-textSecondary'
              }`}
            >
              {l.labelSingularAr}
            </div>
            {i < levels.length - 1 && <span className="text-ds-textDisabled">←</span>}
          </div>
        ))}
      </div>

      {/* ---- Label dictionary editor ---- */}
      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
        >
          <span>الكيان في النواة</span>
          <span>التسمية (مفرد)</span>
          <span>التسمية (جمع)</span>
        </div>
        {levels.map((l, i) => (
          <div
            key={l.key}
            className="grid gap-3 border-b border-ds-rowDivider px-4 py-2.5 text-sm last:border-0"
            style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
          >
            <span className="num text-xs text-ds-textMuted">{l.key}</span>
            <input
              value={l.labelSingularAr}
              onChange={(e) => updateLevelLabel(i, 'labelSingularAr', e.target.value)}
              className="rounded-dsField border border-ds-fieldBorder bg-ds-surface px-2.5 py-1.5 text-sm text-ds-text focus:border-ds-primary focus:outline-none"
            />
            <input
              value={l.labelPluralAr}
              onChange={(e) => updateLevelLabel(i, 'labelPluralAr', e.target.value)}
              className="rounded-dsField border border-ds-fieldBorder bg-ds-surface px-2.5 py-1.5 text-sm text-ds-text focus:border-ds-primary focus:outline-none"
            />
          </div>
        ))}
      </div>

      {/* ---- Core rule callout ---- */}
      <div className="rounded-dsCard bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo p-4 text-xs text-ds-onDarkSecondary">
        <p className="mb-1 font-semibold text-white">قاعدة النواة</p>
        <p>الجداول محايدة ولا تتغيّر أبدًا (organization / branch / site / department / team / shift / person) — هذه التسميات طبقة عرض فقط لكل شركة، ولا تُعدِّل أي استعلام أو بنية بيانات فعلية.</p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-5 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
      >
        {saving ? 'جارٍ الحفظ...' : 'حفظ الهيكل التنظيمي'}
      </button>
    </div>
  );
}

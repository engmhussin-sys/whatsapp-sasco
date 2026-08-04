'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { taskTemplatesApi, TaskTemplate, TaskFieldDefinition, TaskFieldType } from '@/lib/api/task-templates';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const FIELD_TYPES: { type: TaskFieldType; label: string; icon: string }[] = [
  { type: 'TEXT', label: 'نص', icon: '✎' },
  { type: 'NUMBER', label: 'رقم', icon: '#' },
  { type: 'DATE', label: 'تاريخ', icon: '◷' },
  { type: 'TIME', label: 'وقت', icon: '◔' },
  { type: 'PHOTO', label: 'صورة', icon: '◫' },
  { type: 'VIDEO', label: 'فيديو', icon: '▷' },
  { type: 'AUDIO', label: 'صوت', icon: '◍' },
  { type: 'SIGNATURE', label: 'توقيع', icon: '✍' },
  { type: 'GPS', label: 'الموقع', icon: '◎' },
  { type: 'CHECKBOX', label: 'مربّع اختيار', icon: '☑' },
  { type: 'DROPDOWN', label: 'قائمة منسدلة', icon: '▾' },
  { type: 'RADIO', label: 'اختيار واحد', icon: '◉' },
  { type: 'BARCODE', label: 'باركود', icon: '▤' },
  { type: 'QR', label: 'رمز QR', icon: '▦' },
  { type: 'RATING', label: 'تقييم', icon: '★' },
  { type: 'FILE_UPLOAD', label: 'رفع ملف', icon: '⇧' },
];

function newField(type: TaskFieldType): TaskFieldDefinition {
  return { id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, label: 'حقل جديد', required: false };
}

export default function FormBuilderPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [templates, setTemplates] = useState<TaskTemplate[] | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TaskTemplate | null>(null);
  const [fields, setFields] = useState<TaskFieldDefinition[]>([]);
  const [name, setName] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    taskTemplatesApi.list(companyId).then(setTemplates).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل القوالب'));
  }, [companyId]);

  function openTemplate(t: TaskTemplate) {
    setActiveTemplate(t);
    setName(t.name);
    setFields(t.fields);
    setSelectedFieldId(null);
  }

  function newTemplate() {
    setActiveTemplate(null);
    setName('نموذج جديد');
    setFields([]);
    setSelectedFieldId(null);
  }

  function addField(type: TaskFieldType) {
    const field = newField(type);
    setFields((f) => [...f, field]);
    setSelectedFieldId(field.id);
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((f) => {
      const next = [...f];
      const target = index + dir;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeField(id: string) {
    setFields((f) => f.filter((field) => field.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  function updateSelectedField(patch: Partial<TaskFieldDefinition>) {
    setFields((f) => f.map((field) => (field.id === selectedFieldId ? { ...field, ...patch } : field)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (activeTemplate) {
        const updated = await taskTemplatesApi.update(companyId, activeTemplate.id, { name, fields });
        setActiveTemplate(updated);
        setTemplates((prev) => prev?.map((t) => (t.id === updated.id ? updated : t)) ?? null);
      } else {
        const created = await taskTemplatesApi.create(companyId, { name, fields });
        setActiveTemplate(created);
        setTemplates((prev) => [...(prev ?? []), created]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ النموذج');
    } finally {
      setSaving(false);
    }
  }

  if (error && !templates) return <ErrorBanner message={error} />;
  if (!templates) return <Loading />;

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  return (
    <div className="flex h-full flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">باني النماذج</h1>
        <div className="flex items-center gap-2">
          <select
            value={activeTemplate?.id ?? ''}
            onChange={(e) => {
              const t = templates.find((tt) => tt.id === e.target.value);
              if (t) openTemplate(t);
              else newTemplate();
            }}
            className="rounded-dsField border border-ds-fieldBorder bg-ds-surface px-3 py-2 text-sm text-ds-text"
          >
            <option value="">+ نموذج جديد</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (نسخة {t.version})
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving || fields.length === 0}
            className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
          >
            {saving ? 'جارٍ الحفظ...' : activeTemplate ? 'حفظ التعديلات' : 'إنشاء النموذج'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid flex-1 grid-cols-[232px_1fr_300px] gap-3">
        {/* ---- Field type palette ---- */}
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-3">
          <p className="mb-2 text-xs font-medium text-ds-textMuted">أنواع الحقول</p>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.type}
                onClick={() => addField(ft.type)}
                className="flex flex-col items-center gap-1 rounded-dsCardInner border border-ds-fieldBorder p-2.5 text-center transition hover:border-ds-primaryLightBorder hover:bg-ds-primaryLight"
              >
                <span className="text-base text-ds-primary">{ft.icon}</span>
                <span className="text-[10.5px] text-ds-textSecondary">{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Canvas ---- */}
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-3 w-full border-b border-ds-fieldBorder pb-2 text-lg font-semibold text-ds-text focus:outline-none"
            placeholder="اسم النموذج"
          />
          {fields.length === 0 ? (
            <div className="rounded-dsCardInner border-2 border-dashed border-ds-fieldBorder p-8 text-center text-sm text-ds-textDisabled">
              اختر نوع حقل من اليمين لإضافته
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {fields.map((field, i) => (
                <div
                  key={field.id}
                  onClick={() => setSelectedFieldId(field.id)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-dsCardInner border p-3 transition ${
                    selectedFieldId === field.id ? 'border-ds-primary bg-ds-primaryLight shadow-dsCard' : 'border-ds-fieldBorder'
                  }`}
                >
                  <span className="text-sm text-ds-primary">{FIELD_TYPES.find((f) => f.type === field.type)?.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ds-text">
                      {field.label}
                      {field.required && <span className="text-ds-danger"> *</span>}
                    </p>
                    <p className="text-[11px] text-ds-textMuted">{FIELD_TYPES.find((f) => f.type === field.type)?.label}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); moveField(i, -1); }} className="text-ds-textMuted hover:text-ds-primary">
                      ▲
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveField(i, 1); }} className="text-ds-textMuted hover:text-ds-primary">
                      ▼
                    </button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                    className="text-ds-danger hover:text-ds-dangerText"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="rounded-dsCardInner border-2 border-dashed border-ds-fieldBorder p-3 text-center text-xs text-ds-textDisabled">
                أضف حقلًا آخر من اليمين
              </div>
            </div>
          )}
        </div>

        {/* ---- Properties panel ---- */}
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          {!selectedField ? (
            <p className="text-xs text-ds-textMuted">اختر حقلًا لتعديل خصائصه</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">التسمية</label>
                <input
                  value={selectedField.label}
                  onChange={(e) => updateSelectedField({ label: e.target.value })}
                  className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ds-text">
                <input
                  type="checkbox"
                  checked={selectedField.required ?? false}
                  onChange={(e) => updateSelectedField({ required: e.target.checked })}
                />
                حقل إلزامي
              </label>
              {(selectedField.type === 'DROPDOWN' || selectedField.type === 'RADIO') && (
                <div>
                  <label className="mb-1 block text-xs text-ds-textMuted">الخيارات (مفصولة بفاصلة)</label>
                  <input
                    value={selectedField.options?.join(',') ?? ''}
                    onChange={(e) => updateSelectedField({ options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                  />
                </div>
              )}
              {selectedField.type === 'NUMBER' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-ds-textMuted">الحد الأدنى</label>
                    <input
                      type="number"
                      value={selectedField.validation?.min ?? ''}
                      onChange={(e) => updateSelectedField({ validation: { ...selectedField.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                      className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ds-textMuted">الحد الأعلى</label>
                    <input
                      type="number"
                      value={selectedField.validation?.max ?? ''}
                      onChange={(e) => updateSelectedField({ validation: { ...selectedField.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                      className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <div className="border-t border-ds-rowDivider pt-3">
                <label className="mb-1 block text-xs text-ds-textMuted">منطق شرطي — إظهار عند</label>
                <select
                  value={selectedField.conditionalLogic?.dependsOnFieldId ?? ''}
                  onChange={(e) =>
                    updateSelectedField({
                      conditionalLogic: e.target.value
                        ? { dependsOnFieldId: e.target.value, showWhenEquals: selectedField.conditionalLogic?.showWhenEquals ?? '' }
                        : undefined,
                    })
                  }
                  className="mb-2 w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm"
                >
                  <option value="">بلا شرط</option>
                  {fields.filter((f) => f.id !== selectedField.id).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {selectedField.conditionalLogic && (
                  <input
                    value={selectedField.conditionalLogic.showWhenEquals}
                    onChange={(e) =>
                      updateSelectedField({
                        conditionalLogic: { ...selectedField.conditionalLogic!, showWhenEquals: e.target.value },
                      })
                    }
                    placeholder="القيمة المطلوبة"
                    className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

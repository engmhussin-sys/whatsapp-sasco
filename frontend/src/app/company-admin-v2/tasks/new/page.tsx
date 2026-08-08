'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tasksApi, recurringTaskSchedulesApi } from '@/lib/api/tasks';
import { taskTemplatesApi, type TaskTemplate } from '@/lib/api/task-templates';
import { teamsApi, usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Team, AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

type TaskKind = 'ONE_TIME' | 'RECURRING';
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const WEEKDAY_LABELS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function NewTaskPage() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [kind, setKind] = useState<TaskKind>('ONE_TIME');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());

  const [dueAt, setDueAt] = useState('');

  const [frequency, setFrequency] = useState<Frequency>('DAILY');
  const [interval, setIntervalValue] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<Set<number>>(new Set());
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState('08:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([taskTemplatesApi.list(companyId), teamsApi.list(companyId), usersApi.list(companyId)])
      .then(([tpl, tm, us]) => {
        setTemplates(tpl.filter((t) => t.isActive));
        setTeams(tm);
        setUsers(us.items.filter((u) => u.isActive));
      })
      .catch((err) => setOptionsError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات النموذج'))
      .finally(() => setLoadingOptions(false));
  }, [companyId]);

  function toggleAssignee(userId: string) {
    setAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleWeekday(day: number) {
    setDaysOfWeek((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function validateRecurring(): string | null {
    if (!startDate) return 'تاريخ البدء مطلوب للمهام المتكررة';
    if (assigneeIds.size === 0) return 'يجب اختيار مُكلَّف واحد على الأقل للمهام المتكررة';
    if (frequency === 'WEEKLY' && daysOfWeek.size === 0) return 'اختر يوماً واحداً على الأقل من أيام الأسبوع';
    return null;
  }

  async function handleCreate() {
    if (!companyId || !title.trim()) return;

    if (kind === 'RECURRING') {
      const validationError = validateRecurring();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      if (kind === 'ONE_TIME') {
        await tasksApi.create(companyId, {
          title: title.trim(),
          description: description.trim() || undefined,
          templateId: templateId || undefined,
          teamId: teamId || undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          assigneeIds: assigneeIds.size > 0 ? Array.from(assigneeIds) : undefined,
        });
      } else {
        await recurringTaskSchedulesApi.create(companyId, {
          title: title.trim(),
          description: description.trim() || undefined,
          templateId: templateId || undefined,
          teamId: teamId || undefined,
          assigneeIds: Array.from(assigneeIds),
          frequency,
          interval,
          daysOfWeek: frequency === 'WEEKLY' ? Array.from(daysOfWeek) : undefined,
          dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : undefined,
          timeOfDay,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        });
      }
      router.push('/company-admin-v2/tasks');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء المهمة');
    } finally {
      setSaving(false);
    }
  }

  if (loadingOptions) return <Loading />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-[14px]">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">مهمة جديدة</h1>
        <p className="mt-1 text-sm text-ds-textSecondary">أنشئ مهمة وأسندها لفريق أو أفراد محدَّدين.</p>
      </div>

      {optionsError && <ErrorBanner message={optionsError} />}
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col gap-4 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">نوع المهمة</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('ONE_TIME')}
              className={`flex-1 rounded-dsField border px-3 py-2 text-sm font-medium ${
                kind === 'ONE_TIME' ? 'border-ds-primary bg-ds-primaryLight text-ds-primary' : 'border-ds-fieldBorder text-ds-textSecondary'
              }`}
            >
              مرة واحدة
            </button>
            <button
              type="button"
              onClick={() => setKind('RECURRING')}
              className={`flex-1 rounded-dsField border px-3 py-2 text-sm font-medium ${
                kind === 'RECURRING' ? 'border-ds-primary bg-ds-primaryLight text-ds-primary' : 'border-ds-fieldBorder text-ds-textSecondary'
              }`}
            >
              مجدولة (متكررة)
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">العنوان *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: فتح وردية الصباح"
            className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">الوصف</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">القالب (نموذج ديناميكي)</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            >
              <option value="">بلا قالب — مهمة بسيطة</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">الفريق</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            >
              <option value="">بلا فريق محدَّد</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {kind === 'ONE_TIME' ? (
          <div>
            <label className="mb-1 block text-xs text-ds-textMuted">تاريخ الاستحقاق</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-dsCardInner border border-ds-cardBorder p-3">
            <p className="text-xs font-semibold text-ds-text">إعدادات التكرار</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">التكرار</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                >
                  <option value="DAILY">يومي</option>
                  <option value="WEEKLY">أسبوعي</option>
                  <option value="MONTHLY">شهري</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">
                  كل كم {frequency === 'DAILY' ? 'يوم' : frequency === 'WEEKLY' ? 'أسبوع' : 'شهر'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                />
              </div>
            </div>

            {frequency === 'WEEKLY' && (
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">أيام الأسبوع *</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleWeekday(idx)}
                      className={`rounded-dsField border px-2.5 py-1 text-xs ${
                        daysOfWeek.has(idx) ? 'border-ds-primary bg-ds-primaryLight text-ds-primary' : 'border-ds-fieldBorder text-ds-textSecondary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {frequency === 'MONTHLY' && (
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">يوم الشهر *</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-32 rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">وقت اليوم *</label>
                <input
                  type="time"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">تاريخ البدء *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ds-textMuted">تاريخ الانتهاء (اختياري)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">
            {kind === 'ONE_TIME'
              ? 'المُكلَّفون — بلا اختيار تُنشأ المهمة كمسودة (DRAFT) بدل مُسنَدة (ASSIGNED)'
              : 'المُكلَّفون * — تُسنَد كل نسخة مُولَّدة تلقائياً لهؤلاء الأفراد أنفسهم'}
          </label>
          <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-dsCardInner border border-ds-cardBorder p-2">
            {users.length === 0 && <p className="p-2 text-xs text-ds-textDisabled">لا يوجد مستخدمون نشطون</p>}
            {users.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-dsCardInner px-2 py-1.5 hover:bg-ds-hover">
                <input
                  type="checkbox"
                  checked={assigneeIds.has(u.id)}
                  onChange={() => toggleAssignee(u.id)}
                  className="h-4 w-4 accent-ds-primary"
                />
                <span className="text-sm text-ds-text">
                  {u.firstName} {u.lastName}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={saving || !title.trim()}
            className="w-fit rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-5 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
          >
            {saving ? 'جارٍ الإنشاء...' : kind === 'ONE_TIME' ? 'إنشاء المهمة' : 'إنشاء الجدول المتكرر'}
          </button>
          <button
            onClick={() => router.back()}
            disabled={saving}
            className="w-fit rounded-dsField border border-ds-fieldBorder px-5 py-2 text-sm font-medium text-ds-text disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>

      {kind === 'RECURRING' && (
        <p className="text-xs text-ds-textDisabled">
          ملاحظة: أول نسخة فعلية من هذه المهمة تُنشأ آلياً عند حلول أول موعد مطابق بعد الحفظ (وليس فوراً) — النظام
          يفحص الجداول النشطة مرة يومياً.
        </p>
      )}
    </div>
  );
}

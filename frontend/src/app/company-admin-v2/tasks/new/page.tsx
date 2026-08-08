'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tasksApi } from '@/lib/api/tasks';
import { taskTemplatesApi, type TaskTemplate } from '@/lib/api/task-templates';
import { teamsApi, usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Team, AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function NewTaskPage() {
  const router = useRouter();
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<Set<string>>(new Set());

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

  async function handleCreate() {
    if (!companyId || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await tasksApi.create(companyId, {
        title: title.trim(),
        description: description.trim() || undefined,
        templateId: templateId || undefined,
        teamId: teamId || undefined,
        // <input type="datetime-local"> يُعيد نصاً بلا منطقة زمنية —
        // new Date(...).toISOString() يحوّله لصيغة ISO 8601 كاملة يتوقعها
        // الخادم (dto.dueAt يمر مباشرة إلى `new Date(dto.dueAt)`).
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        assigneeIds: assigneeIds.size > 0 ? Array.from(assigneeIds) : undefined,
      });
      // لا توجد صفحة تفاصيل مهمة فردية على الويب بعد (/tasks/[taskId]) —
      // العودة للوحة المهام نفسها، حيث تظهر المهمة الجديدة فوراً.
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

        <div>
          {/* CreateTaskDto.dueAt: تاريخ استحقاق واحد فقط — لا يدعم الخادم
           * حالياً وقت بدء منفصل أو تكراراً؛ راجع الملاحظة أسفل الصفحة. */}
          <label className="mb-1 block text-xs text-ds-textMuted">تاريخ الاستحقاق</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">
            المُكلَّفون — بلا اختيار تُنشأ المهمة كمسودة (DRAFT) بدل مُسنَدة (ASSIGNED)
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
            {saving ? 'جارٍ الإنشاء...' : 'إنشاء المهمة'}
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

      <p className="text-xs text-ds-textDisabled">
        ملاحظة: النظام حالياً يدعم تاريخ استحقاق واحداً فقط — لا يدعم بعد جدولة وقت بدء منفصل أو تكرار المهام
        (يومي/أسبوعي). لا يوجد أيضاً تصنيف &quot;نوع مهمة&quot; مُقنَّن؛ القالب هو أقرب تصنيف متاح حالياً.
      </p>
    </div>
  );
}

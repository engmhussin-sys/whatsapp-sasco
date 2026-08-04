'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import { taskTemplatesApi, TaskTemplate } from '@/lib/api/task-templates';
import type { Company } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

/**
 * Sprint 10 — Generic Work Orders. This does NOT reimplement fuel
 * requests; it surfaces the SAME mechanism already built in Sprint 7
 * (TaskTemplate + attached ApprovalFlow, tagged domainTag='work_order')
 * under whatever label this company has configured (SASCO sees "طلبات
 * وقود" by default; other industries configure their own label from
 * their taxonomy/settings). Fuel companies keep using the purpose-built
 * FuelRequest flow they already have — this screen is for NEW,
 * non-fuel companies building their own work-order type from scratch.
 */
export default function WorkOrdersPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [company, setCompany] = useState<Company | null>(null);
  const [templates, setTemplates] = useState<TaskTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([companiesApi.get(companyId), taskTemplatesApi.list(companyId, 'work_order')])
      .then(([c, t]) => {
        setCompany(c);
        setTemplates(t);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل أوامر العمل'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!company || !templates) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">{company.workOrderLabelPluralAr}</h1>
        <a
          href="/super-admin-v2/forms"
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          + إنشاء نوع {company.workOrderLabelSingularAr} جديد
        </a>
      </div>

      <p className="text-sm text-ds-textSecondary">
        كل نوع هنا هو نموذج ديناميكي مُرفَق بمسار موافقة — يُبنى عبر باني النماذج، ويُدار من هنا.
      </p>

      {templates.length === 0 ? (
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-8 text-center text-sm text-ds-textSecondary">
          لا توجد أنواع {company.workOrderLabelPluralAr} بعد — أنشئ أول نموذج من باني النماذج، واختر الوسم{' '}
          <code className="rounded bg-ds-trackBg px-1.5 py-0.5 text-xs">work_order</code>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
              <p className="text-sm font-semibold text-ds-text">{t.name}</p>
              <p className="mt-1 text-xs text-ds-textSecondary">{t.fields.length} حقل · نسخة {t.version}</p>
              <span
                className={`mt-2 inline-block rounded-dsPill px-2 py-0.5 text-[11px] ${
                  t.approvalFlowId ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-warningBg text-ds-warningText'
                }`}
              >
                {t.approvalFlowId ? 'مرتبط بمسار موافقة' : 'بلا مسار موافقة'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

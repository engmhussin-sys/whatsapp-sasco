'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { tasksApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { TaskItem, TaskFieldDefinition } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const FILE_FIELD_TYPES = new Set(['PHOTO', 'VIDEO', 'AUDIO', 'SIGNATURE']);

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();

  const [task, setTask] = useState<TaskItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user?.companyId) return;
    tasksApi
      .get(user.companyId, taskId)
      .then(setTask)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المهمة'));
  }, [user, taskId]);

  function setAnswer(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  function captureGps(fieldId: string) {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع الجغرافي');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setAnswer(fieldId, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('تعذّر الحصول على الموقع الجغرافي — تحقق من إذن المتصفح'),
    );
  }

  async function handleSubmit() {
    if (!user?.companyId || !task?.template) return;

    // Client-side required-field check mirrors the backend's own
    // validation so the user gets instant feedback before the round-trip.
    for (const field of task.template.fields) {
      const hasFile = FILE_FIELD_TYPES.has(field.type) && files[field.id];
      const hasAnswer = answers[field.id] !== undefined && answers[field.id] !== '';
      if (field.required && !hasFile && !hasAnswer) {
        setError(`الحقل "${field.label}" مطلوب`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      // For file-based fields, submit a placeholder marker first (the
      // backend's required-field check only needs a truthy value), then
      // upload the real file against the newly-created TaskResponse.
      const finalAnswers: Record<string, unknown> = { ...answers };
      for (const field of task.template.fields) {
        if (FILE_FIELD_TYPES.has(field.type) && files[field.id]) {
          finalAnswers[field.id] = { fileName: files[field.id].name };
        }
      }

      const updatedTask = await tasksApi.submitResponse(user.companyId, taskId, finalAnswers) as unknown as TaskItem & {
        responses: { id: string; submittedAt: string }[];
      };

      const newResponse = updatedTask.responses
        ?.slice()
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

      if (newResponse) {
        for (const field of task.template.fields) {
          const file = files[field.id];
          if (file) {
            await tasksApi.uploadAttachment(user.companyId, newResponse.id, file, field.id, field.type);
          }
        }
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال المهمة');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !task) return <ErrorBanner message={error} />;
  if (!task) return <Loading />;

  const alreadySubmitted = task.status !== 'DRAFT' && task.status !== 'ASSIGNED' && task.status !== 'IN_PROGRESS';

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-lg font-bold">{task.title}</h1>
      {task.description && <p className="mb-4 text-sm text-slate-500">{task.description}</p>}

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {done && (
        <div className="card mb-4 bg-green-50 text-green-700">تم إرسال المهمة بنجاح.</div>
      )}

      {!task.template && <p className="text-sm text-slate-400">هذه مهمة بسيطة بدون نموذج مرفق.</p>}

      {task.template && (alreadySubmitted || done) && (
        <div className="card text-sm text-slate-500">
          تم إرسال هذه المهمة مسبقًا (الحالة: {task.status}). لا يمكن إعادة الإرسال من هذه الشاشة.
        </div>
      )}

      {task.template && !alreadySubmitted && !done && (
        <div className="card space-y-4">
          {task.template.fields.map((field) => (
            <DynamicField
              key={field.id}
              field={field}
              value={answers[field.id]}
              file={files[field.id]}
              onChange={(v) => setAnswer(field.id, v)}
              onFile={(f) => setFiles((prev) => ({ ...prev, [field.id]: f }))}
              onCaptureGps={() => captureGps(field.id)}
            />
          ))}

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? 'جارٍ الإرسال...' : 'إرسال المهمة'}
          </button>
        </div>
      )}
    </div>
  );
}

function DynamicField({
  field,
  value,
  file,
  onChange,
  onFile,
  onCaptureGps,
}: {
  field: TaskFieldDefinition;
  value: unknown;
  file?: File;
  onChange: (v: unknown) => void;
  onFile: (f: File) => void;
  onCaptureGps: () => void;
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`;

  switch (field.type) {
    case 'TEXT':
      return (
        <div>
          <label className="label">{label}</label>
          <input className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'NUMBER':
      return (
        <div>
          <label className="label">{label}</label>
          <input type="number" className="input" value={(value as number) ?? ''} onChange={(e) => onChange(Number(e.target.value))} />
        </div>
      );
    case 'DATE':
      return (
        <div>
          <label className="label">{label}</label>
          <input type="date" className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'TIME':
      return (
        <div>
          <label className="label">{label}</label>
          <input type="time" className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case 'CHECKBOX':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
      );
    case 'DROPDOWN':
      return (
        <div>
          <label className="label">{label}</label>
          <select className="input" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">اختر...</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
    case 'GPS':
      return (
        <div>
          <label className="label">{label}</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCaptureGps} className="rounded-lg bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">
              📍 تحديد الموقع الحالي
            </button>
            {!!value && (
              <span className="text-xs text-slate-500">
                {(value as { lat: number; lng: number }).lat.toFixed(5)}, {(value as { lat: number; lng: number }).lng.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      );
    case 'PHOTO':
    case 'VIDEO':
    case 'AUDIO':
    case 'SIGNATURE':
      return (
        <div>
          <label className="label">{label}</label>
          <input
            type="file"
            accept={field.type === 'PHOTO' ? 'image/*' : field.type === 'VIDEO' ? 'video/*' : field.type === 'AUDIO' ? 'audio/*' : undefined}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm"
          />
          {file && <p className="mt-1 text-xs text-green-600">تم اختيار: {file.name}</p>}
        </div>
      );
    default:
      return null;
  }
}

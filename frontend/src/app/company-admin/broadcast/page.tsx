'use client';

import { useEffect, useState } from 'react';
import { broadcastApi, type BroadcastTargetType } from '@/lib/api/broadcast';
import { languagesApi, type CompanyLanguage } from '@/lib/api/languages';
import { stationsApi, type Station } from '@/lib/api/stations';
import { teamsApi, usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Team, AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const ROLE_OPTIONS = [
  { value: 'WORKER', label: 'العمّال' },
  { value: 'TEAM_LEAD', label: 'قادة الفرق' },
  { value: 'COMPANY_ADMIN', label: 'مديرو الشركة' },
];

const TARGET_OPTIONS: { value: BroadcastTargetType; icon: string; title: string; desc: string }[] = [
  { value: 'ALL', icon: '📢', title: 'الجميع', desc: 'كل عضو نشط في الشركة' },
  { value: 'ROLE', icon: '🏷️', title: 'فئة مُحدَّدة', desc: 'كل من لديه دور مُعيَّن (مثل كل العمّال)' },
  { value: 'STATION', icon: '⛽', title: 'محطة مُحدَّدة', desc: 'كل الموظفين المُعيَّنين على محطة واحدة' },
  { value: 'TEAM', icon: '👥', title: 'فريق مُحدَّد', desc: 'أعضاء فريق واحد فقط' },
  { value: 'USER', icon: '👤', title: 'شخص واحد', desc: 'رسالة مباشرة لموظف بعينه' },
];

export default function BroadcastPage() {
  const { user } = useAuth();
  const [languages, setLanguages] = useState<CompanyLanguage[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [text, setText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recipientCount: number } | null>(null);

  // ---- Target audience ----
  const [targetType, setTargetType] = useState<BroadcastTargetType>('ALL');
  const [selectedRole, setSelectedRole] = useState('WORKER');
  const [selectedStationId, setSelectedStationId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (!user?.companyId) return;
    Promise.all([languagesApi.listCompanyLanguages(user.companyId), stationsApi.list(user.companyId), teamsApi.list(user.companyId), usersApi.list(user.companyId)])
      .then(([langs, st, tm, us]) => {
        setLanguages(langs);
        setStations(st);
        setTeams(tm);
        setUsers(us.items);
        const preferred = langs.find((l) => l.langCode === user.preferredLanguage);
        setSourceLanguage(preferred?.langCode ?? langs[0]?.langCode ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات النموذج'))
      .finally(() => setLoadingData(false));
  }, [user]);

  const isTargetValid =
    targetType === 'ALL' ||
    (targetType === 'ROLE' && selectedRole) ||
    (targetType === 'STATION' && selectedStationId) ||
    (targetType === 'TEAM' && selectedTeamId) ||
    (targetType === 'USER' && selectedUserId);

  async function handleSend() {
    if (!user?.companyId || !text.trim() || !sourceLanguage || !isTargetValid) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await broadcastApi.send(user.companyId, {
        text: text.trim(),
        sourceLanguage,
        targetType,
        urgent,
        ...(targetType === 'ROLE' ? { role: selectedRole } : {}),
        ...(targetType === 'STATION' ? { stationId: selectedStationId } : {}),
        ...(targetType === 'TEAM' ? { teamId: selectedTeamId } : {}),
        ...(targetType === 'USER' ? { userId: selectedUserId } : {}),
      });
      setResult({ recipientCount: res.recipientCount });
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  if (loadingData) return <Loading />;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-bold">إرسال رسالة</h1>
      <p className="mb-5 text-sm text-ink-500">حدِّد المستلمين، ثم تصل الرسالة تلقائيًا مُترجَمة إلى لغة كل شخص.</p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {result && (
        <div className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
          أُرسلت الرسالة بنجاح إلى {result.recipientCount.toLocaleString('ar')} مستلمًا — سيراها كل شخص بلغته المفضّلة تلقائيًا.
        </div>
      )}

      <div className="card space-y-5">
        {/* ---- Step 1: Who ---- */}
        <div>
          <p className="label">إلى من تُرسَل الرسالة؟</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetType(opt.value)}
                className={`rounded-xl border-2 p-3 text-right transition ${
                  targetType === opt.value ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-ink-200'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span>{opt.icon}</span>
                  <span className="text-sm font-bold text-ink-900">{opt.title}</span>
                </div>
                <p className="text-xs text-ink-500">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* ---- Conditional recipient picker ---- */}
          {targetType === 'ROLE' && (
            <select className="input mt-3" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          {targetType === 'STATION' && (
            <select className="input mt-3" value={selectedStationId} onChange={(e) => setSelectedStationId(e.target.value)}>
              <option value="">اختر المحطة...</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {targetType === 'TEAM' && (
            <select className="input mt-3" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
              <option value="">اختر الفريق...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {targetType === 'USER' && (
            <select className="input mt-3" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">اختر الشخص...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ---- Supported languages ---- */}
        <div className="border-t border-ink-100 pt-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-700">اللغات المدعومة في النظام</label>
          {languages.length === 0 ? (
            <p className="text-sm text-ink-400">لم تُفعّل أي لغة لهذه الشركة بعد.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {languages.map((cl) => (
                <span key={cl.langCode} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                  {cl.language.nativeName} ({cl.langCode})
                  {cl.language.isRtl && ' · RTL'}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ---- Source language ---- */}
        <div>
          <label className="label" htmlFor="sourceLanguage">
            اللغة التي تكتب بها هذه الرسالة
          </label>
          <select id="sourceLanguage" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} className="input" disabled={languages.length === 0}>
            {languages.map((cl) => (
              <option key={cl.langCode} value={cl.langCode}>
                {cl.language.nativeName} ({cl.langCode})
              </option>
            ))}
          </select>
        </div>

        {/* ---- Message text ---- */}
        <div>
          <label className="label" htmlFor="broadcastText">
            نص الرسالة
          </label>
          <textarea
            id="broadcastText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={4000}
            className="input resize-none"
            placeholder="اكتب رسالتك هنا..."
          />
          <p className="mt-1 text-left text-xs text-ink-400">{text.length} / 4000</p>
        </div>

        {targetType === 'ALL' && (
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4 rounded border-ink-300" />
            إشعار طارئ (Emergency) — لأولوية أعلى مثل حالات الطوارئ الفعلية
          </label>
        )}

        <button onClick={handleSend} disabled={sending || !text.trim() || !sourceLanguage || !isTargetValid} className="btn-primary">
          {sending ? 'جارٍ الإرسال...' : 'إرسال'}
        </button>
      </div>
    </div>
  );
}

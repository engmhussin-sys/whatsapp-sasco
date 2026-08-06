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

// B1 fix: أيقونات نصية بسيطة (لا إيموجي) — نفس مبدأ الإصلاح المُطبَّق
// سابقًا على معدّات الوقاية والمحادثات.
const TARGET_OPTIONS: { value: BroadcastTargetType; icon: string; title: string; desc: string }[] = [
  { value: 'ALL', icon: '◉', title: 'الجميع', desc: 'كل عضو نشط في الشركة' },
  { value: 'ROLE', icon: '◫', title: 'فئة مُحدَّدة', desc: 'كل من لديه دور مُعيَّن (مثل كل العمّال)' },
  { value: 'STATION', icon: '◈', title: 'محطة مُحدَّدة', desc: 'كل الموظفين المُعيَّنين على محطة واحدة' },
  { value: 'TEAM', icon: '◫', title: 'فريق مُحدَّد', desc: 'أعضاء فريق واحد فقط' },
  { value: 'USER', icon: '◐', title: 'شخص واحد', desc: 'رسالة مباشرة لموظف بعينه' },
];

export default function BroadcastV2Page() {
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
    <div className="mx-auto flex max-w-2xl flex-col gap-[14px]">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إرسال رسالة</h1>
        <p className="mt-1 text-sm text-ds-textSecondary">حدِّد المستلمين، ثم تصل الرسالة تلقائيًا مُترجَمة إلى لغة كل شخص.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {result && (
        <div className="rounded-dsCardInner bg-ds-primaryLight px-3 py-2 text-sm text-ds-primaryDarker">
          أُرسلت الرسالة بنجاح إلى {result.recipientCount.toLocaleString('en')} مستلمًا — سيراها كل شخص بلغته المفضّلة تلقائيًا.
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ds-text">إلى من تُرسَل الرسالة؟</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TARGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetType(opt.value)}
                className={`rounded-dsCard border-2 p-3 text-right transition ${
                  targetType === opt.value ? 'border-ds-primary bg-ds-primaryLight' : 'border-ds-cardBorder hover:border-ds-fieldBorder'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-ds-primary">{opt.icon}</span>
                  <span className="text-sm font-bold text-ds-text">{opt.title}</span>
                </div>
                <p className="text-xs text-ds-textSecondary">{opt.desc}</p>
              </button>
            ))}
          </div>

          {targetType === 'ROLE' && (
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="mt-3 w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )}
          {targetType === 'STATION' && (
            <select value={selectedStationId} onChange={(e) => setSelectedStationId(e.target.value)} className="mt-3 w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
              <option value="">اختر المحطة...</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {targetType === 'TEAM' && (
            <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="mt-3 w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
              <option value="">اختر الفريق...</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {targetType === 'USER' && (
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="mt-3 w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
              <option value="">اختر الشخص...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.phone ?? u.email ?? '—'})</option>)}
            </select>
          )}
        </div>

        <div className="border-t border-ds-rowDivider pt-4">
          <label className="mb-1.5 block text-sm font-medium text-ds-text">اللغات المدعومة في النظام</label>
          {languages.length === 0 ? (
            <p className="text-sm text-ds-textDisabled">لم تُفعّل أي لغة لهذه الشركة بعد.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {languages.map((cl) => (
                <span key={cl.langCode} className="rounded-dsPill bg-ds-primaryLight px-3 py-1 text-xs text-ds-primaryDarker">
                  {cl.language.nativeName} ({cl.langCode}){cl.language.isRtl && ' · RTL'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="sourceLanguage">اللغة التي تكتب بها هذه الرسالة</label>
          <select id="sourceLanguage" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} disabled={languages.length === 0} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm disabled:opacity-50">
            {languages.map((cl) => <option key={cl.langCode} value={cl.langCode}>{cl.language.nativeName} ({cl.langCode})</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ds-textMuted" htmlFor="broadcastText">نص الرسالة</label>
          <textarea
            id="broadcastText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="اكتب رسالتك هنا..."
            className="w-full resize-none rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
          <p className="num mt-1 text-left text-xs text-ds-textDisabled">{text.length} / 4000</p>
        </div>

        {targetType === 'ALL' && (
          <label className="flex items-center gap-2 text-sm text-ds-text">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-4 w-4 rounded border-ds-fieldBorder" />
            إشعار طارئ (Emergency) — لأولوية أعلى مثل حالات الطوارئ الفعلية
          </label>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !text.trim() || !sourceLanguage || !isTargetValid}
          className="w-fit rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-6 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
        >
          {sending ? 'جارٍ الإرسال...' : 'إرسال'}
        </button>
      </div>
    </div>
  );
}

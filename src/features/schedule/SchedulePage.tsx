import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useScheduleStore } from '../../store/useScheduleStore';
import type { ScheduleDay, MonthData, ShiftType } from '../../types/schedule';

// ─── UTILS ────────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const mkKey = (y: number, m: number) => `${y}-${pad(m)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dow = (y: number, m: number, d: number) => DOW[new Date(y, m - 1, d).getDay()];
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const CONTRACT_H = 9.5;
const TARGET_OFF = 7;

// ─── SCHEDULE ALGORITHM ───────────────────────────────────────────────────────
function genSchedule(year: number, month: number, aOff: number[], bOff: number[]): ScheduleDay[] {
  const days = daysInMonth(year, month);
  const aSet = new Set(aOff), bSet = new Set(bOff);
  const sch: ScheduleDay[] = [];
  let lastSolo: 'a' | 'b' | null = null, prevBoth = false, prevAEarly = false;

  for (let d = 1; d <= days; d++) {
    const ao = aSet.has(d), bo = bSet.has(d);
    if (ao && bo) {
      sch.push({ day: d, a: 'conflict', b: 'conflict', aEnd: null, bEnd: null });
    } else if (ao) {
      sch.push({ day: d, a: 'off', b: 'solo', aEnd: null, bEnd: '20:00' });
      lastSolo = 'b'; prevBoth = false;
    } else if (bo) {
      sch.push({ day: d, a: 'solo', b: 'off', aEnd: '20:00', bEnd: null });
      lastSolo = 'a'; prevBoth = false;
    } else {
      const aEarly: boolean = prevBoth ? !prevAEarly : lastSolo === 'a';
      sch.push({
        day: d,
        a: aEarly ? 'early' : 'closing',
        b: aEarly ? 'closing' : 'early',
        aEnd: aEarly ? '18:30' : '20:00',
        bEnd: aEarly ? '20:00' : '18:30',
      });
      prevAEarly = aEarly; prevBoth = true;
    }
  }

  (['a', 'b'] as const).forEach((p) => {
    let actual = 0, working = 0;
    sch.forEach((s) => {
      const t = s[p];
      if (t === 'off' || t === 'conflict') return;
      working++;
      actual += t === 'early' ? 8.5 : 10;
    });
    const need = working * CONTRACT_H - actual;
    if (need < 0.01) return;
    for (let i = sch.length - 1; i >= 0; i--) {
      if (sch[i][p] === 'early') {
        const addMin = Math.round(need * 60);
        const base = 18 * 60 + 30 + addMin;
        sch[i] = {
          ...sch[i],
          [`${p}End`]: `${pad(Math.floor(base / 60))}:${pad(base % 60)}`,
          [`${p}Adj`]: true,
        };
        break;
      }
    }
  });
  return sch;
}

interface Stats {
  actual: number; contract: number; working: number;
  solo: number; early: number; closing: number; diff: number;
}

function calcStats(sch: ScheduleDay[], p: 'a' | 'b'): Stats {
  let actual = 0, working = 0, solo = 0, early = 0, closing = 0;
  (sch || []).forEach((s) => {
    const t = s[p];
    if (!t || t === 'off' || t === 'conflict') return;
    working++;
    if (t === 'solo')    { solo++; actual += 10; }
    if (t === 'closing') { closing++; actual += 10; }
    if (t === 'early') {
      early++;
      const end = (p === 'a' ? s.aEnd : s.bEnd) || '18:30';
      const [h, m] = end.split(':').map(Number);
      actual += (h * 60 + m - 600) / 60;
    }
  });
  const contract = working * CONTRACT_H;
  const diff = Math.round((actual - contract) * 10) / 10;
  return { actual: Math.round(actual * 10) / 10, contract, working, solo, early, closing, diff };
}

const STATUS_PILL: Record<string, string> = {
  none: 'bg-gray-100 text-gray-400',
  generated: 'bg-violet-100 text-violet-700',
  manager_approved: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  none: '대기 중', generated: '스케줄 생성됨', manager_approved: '검수 요청 중',
  approved: '✅ 최종 승인', rejected: '❌ 반려',
};

const SHIFT_STYLE: Record<string, string> = {
  solo:     'bg-amber-50 text-amber-700 border-amber-200',
  closing:  'bg-blue-50 text-blue-700 border-blue-200',
  early:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  off:      'bg-gray-50 text-gray-400 border-gray-100',
  conflict: 'bg-red-50 text-red-600 border-red-200',
};

function shiftLabel(type: ShiftType, end: string | null, adj?: boolean) {
  if (type === 'solo')     return '1인 ~20:00';
  if (type === 'closing')  return '~20:00';
  if (type === 'early')    return `~${end || '18:30'}${adj ? ' ✎' : ''}`;
  if (type === 'off')      return '휴무';
  if (type === 'conflict') return '⚠ 충돌';
  return '';
}

function ShiftBadge({ type, end, adj }: { type: ShiftType | undefined; end: string | null; adj?: boolean }) {
  if (!type) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${SHIFT_STYLE[type] || SHIFT_STYLE.off}`}>
      {shiftLabel(type, end, adj)}
    </span>
  );
}

function CalPicker({ year, month, myOff, partnerOff, submitted, onToggle }: {
  year: number; month: number; myOff: number[]; partnerOff: number[];
  submitted: boolean; onToggle: (d: number) => void;
}) {
  const days = daysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1 select-none">
        {DOW.map((d) => (
          <div key={d} className={`py-1 ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : ''}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const isMy = myOff.includes(d);
          const isPt = partnerOff.includes(d);
          const clash = isMy && isPt;
          const colIdx = (firstDow + d - 1) % 7;
          const isWeekend = colIdx === 0 || colIdx === 6;
          return (
            <button
              key={d}
              onClick={() => !submitted && onToggle(d)}
              title={isPt ? '상대방 선택일' : ''}
              className={`aspect-square rounded-xl text-sm font-semibold flex flex-col items-center justify-center gap-0.5 transition-all select-none
                ${clash
                  ? 'bg-red-500 text-white ring-2 ring-red-300 ring-offset-1'
                  : isMy
                  ? 'bg-gray-900 text-white shadow-md'
                  : isPt
                  ? 'bg-sky-100 text-sky-600 ring-1 ring-sky-200'
                  : submitted
                  ? 'text-gray-300 cursor-default'
                  : isWeekend
                  ? 'text-gray-500 hover:bg-gray-100'
                  : 'text-gray-700 hover:bg-gray-100 cursor-pointer'}`}
            >
              <span>{d}</span>
              {isPt && !isMy && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-70" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleTable({ sch, nameA, nameB, year, month }: {
  sch: ScheduleDay[]; nameA: string; nameB: string; year: number; month: number;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-2 text-gray-400 font-medium w-10">일</th>
            <th className="text-left py-2 px-1 text-gray-400 font-medium w-6">요일</th>
            <th className="text-center py-2 px-2 font-semibold text-amber-700">{nameA}</th>
            <th className="text-center py-2 px-2 font-semibold text-blue-700">{nameB}</th>
          </tr>
        </thead>
        <tbody>
          {sch.map((s) => {
            const d = dow(year, month, s.day);
            return (
              <tr key={s.day} className={`border-b border-gray-50 ${s.a === 'conflict' ? 'bg-red-50' : ''}`}>
                <td className={`py-1.5 px-2 font-bold ${d === '일' ? 'text-red-400' : d === '토' ? 'text-blue-400' : 'text-gray-700'}`}>
                  {s.day}
                </td>
                <td className="py-1.5 px-1 text-gray-400">{d}</td>
                <td className="py-1.5 px-2 text-center">
                  <ShiftBadge type={s.a} end={s.aEnd} adj={s.aAdj} />
                </td>
                <td className="py-1.5 px-2 text-center">
                  <ShiftBadge type={s.b} end={s.bEnd} adj={s.bAdj} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatGrid({ name, stats, accent }: { name: string; stats: Stats; accent: 'a' | 'b' }) {
  const rows: [string, string][] = [
    ['근무일', stats.working + '일'],
    ['1인 근무', stats.solo + '일'],
    ['마감(20시)', stats.closing + '일'],
    ['조기퇴근', stats.early + '일'],
    ['계약시간', stats.contract + 'h'],
    ['실제시간', stats.actual + 'h'],
    ['차이', (stats.diff >= 0 ? '+' : '') + stats.diff + 'h'],
  ];
  const headerCls = accent === 'a' ? 'text-amber-700' : 'text-blue-700';
  const borderCls = accent === 'a' ? 'border-amber-100' : 'border-blue-100';
  return (
    <div className={`rounded-xl border p-4 ${borderCls}`}>
      <div className={`text-sm font-bold mb-3 ${headerCls}`}>{name}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map(([l, v]) => {
          const isDiff = l === '차이';
          const diffCls = isDiff
            ? Math.abs(stats.diff) < 0.1 ? 'bg-emerald-50' : stats.diff > 0 ? 'bg-red-50' : 'bg-blue-50'
            : 'bg-gray-50';
          const valCls = isDiff
            ? Math.abs(stats.diff) < 0.1 ? 'text-emerald-700' : stats.diff > 0 ? 'text-red-700' : 'text-blue-700'
            : 'text-gray-700';
          return (
            <div key={l} className={`flex justify-between items-center rounded-lg px-2 py-1 ${diffCls}`}>
              <span className="text-gray-400 text-xs">{l}</span>
              <span className={`text-xs font-semibold ${valCls}`}>{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmployeeView({
  p, myName, myOff, partnerOff, submitted, year, month, sch, stats, nameA, nameB,
  onToggle, onSubmit, onUnsubmit, canUnsubmit,
}: {
  p: 'a' | 'b'; myName: string; myOff: number[]; partnerOff: number[];
  submitted: boolean; year: number; month: number; sch: ScheduleDay[] | null;
  stats: Stats | null; nameA: string; nameB: string;
  onToggle: (d: number) => void; onSubmit: () => void;
  onUnsubmit: () => void; canUnsubmit: boolean;
}) {
  const [tab, setTab] = useState<'offday' | 'schedule'>('offday');
  const remaining = TARGET_OFF - myOff.length;
  const myClash = myOff.filter((d) => partnerOff.includes(d));
  const pillCls = submitted
    ? 'bg-emerald-100 text-emerald-700'
    : p === 'a' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{myName}님 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">{year}년 {MONTHS[month - 1]} 근무 스케줄</p>
        </div>
        <div className={`text-xs px-3 py-1.5 rounded-full font-semibold ${pillCls}`}>
          {submitted ? '✅ 제출 완료' : `${myOff.length} / ${TARGET_OFF}일 선택`}
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
        {(['offday', 'schedule'] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            {id === 'offday' ? '🗓 휴무 신청' : '📋 내 스케줄'}
          </button>
        ))}
      </div>

      {tab === 'offday' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">휴무일 선택</span>
            <span className="text-xs text-gray-400">🔵 = 상대방 선택일</span>
          </div>
          {myClash.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">
              ⚠️ <strong>{myClash.sort((a, b) => a - b).map((d) => d + '일').join(', ')}</strong>이 상대방과 겹쳐요.
            </div>
          )}
          <CalPicker year={year} month={month} myOff={myOff} partnerOff={partnerOff}
            submitted={submitted} onToggle={onToggle} />
          {!submitted ? (
            <button
              onClick={onSubmit}
              disabled={remaining !== 0 || myClash.length > 0}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                remaining === 0 && myClash.length === 0
                  ? 'bg-gray-900 text-white hover:bg-gray-700 active:scale-95'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              {myClash.length > 0 ? '⚠️ 충돌 해결 후 제출 가능'
                : remaining > 0 ? `${remaining}일 더 선택하세요`
                : '휴무 신청 제출하기 →'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="bg-emerald-50 rounded-xl p-3 text-center text-sm text-emerald-700 font-medium">
                ✅ 제출 완료! 관리자 승인 후 스케줄이 확정됩니다.
              </div>
              {canUnsubmit && (
                <button onClick={onUnsubmit}
                  className="w-full py-2 rounded-xl text-xs text-gray-400 border border-gray-100 hover:bg-gray-50">
                  취소하고 다시 선택하기
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {!sch ? (
            <div className="py-10 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-gray-500">스케줄이 아직 생성되지 않았어요</p>
              <p className="text-xs text-gray-400 mt-1">양측 휴무 제출 후 관리자가 생성합니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats && (
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['근무일', stats.working + '일', 'text-gray-900'],
                    ['계약', stats.contract + 'h', 'text-blue-700'],
                    ['실제', stats.actual + 'h', Math.abs(stats.diff) < 0.1 ? 'text-emerald-600' : 'text-amber-600'],
                  ] as [string, string, string][]).map(([l, v, c]) => (
                    <div key={l} className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <div className="text-xs text-gray-400">{l}</div>
                      <div className={`text-base font-bold mt-0.5 ${c}`}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="max-h-96 overflow-y-auto">
                <ScheduleTable sch={sch} nameA={nameA} nameB={nameB} year={year} month={month} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManagerView({
  year, month, nameA, nameB, onNameAChange, onNameBChange,
  md, conflicts, canGen, aStats, bStats,
  onGenerate, onReset, onSendReview, onManualAdj,
}: {
  year: number; month: number; nameA: string; nameB: string;
  onNameAChange: (v: string) => void; onNameBChange: (v: string) => void;
  md: MonthData; conflicts: number[]; canGen: boolean;
  aStats: Stats | null; bStats: Stats | null;
  onGenerate: () => void; onReset: () => void; onSendReview: () => void;
  onManualAdj: (day: number, p: 'a' | 'b', newEnd: string) => void;
}) {
  const [tab, setTab] = useState<'status' | 'schedule' | 'adjust'>('status');
  const [adjDay, setAdjDay] = useState('');
  const [adjP, setAdjP] = useState<'a' | 'b'>('a');
  const [adjEnd, setAdjEnd] = useState('19:00');

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">관리자 대시보드</h1>

      <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
        {(['status', 'schedule', 'adjust'] as const).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            {id === 'status' ? '📊 현황' : id === 'schedule' ? '🗓 스케줄' : '✎ 조정'}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">직원 이름 설정</p>
            <div className="flex gap-2">
              {([['a', nameA, onNameAChange, 'amber'], ['b', nameB, onNameBChange, 'blue']] as const).map(([p, name, onChange, c]) => (
                <div key={p} className="flex-1">
                  <label className={`text-xs font-medium mb-1 block ${c === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>
                    직원 {p.toUpperCase()}
                  </label>
                  <input value={name} onChange={(e) => onChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([['a', nameA, md.aOff, md.aSub, 'amber'], ['b', nameB, md.bOff, md.bSub, 'blue']] as const).map(([p, name, off, sub, c]) => (
              <div key={p} className={`bg-white rounded-2xl border p-4 shadow-sm ${c === 'amber' ? 'border-amber-100' : 'border-blue-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${c === 'amber' ? 'text-amber-700' : 'text-blue-700'}`}>{name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sub ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {sub ? '제출완료' : `${off.length}/7`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {off.length > 0
                    ? off.sort((a, b) => a - b).map((d) => (
                        <span key={d} className={`text-xs px-1.5 py-0.5 rounded-lg font-medium ${conflicts.includes(d) ? 'bg-red-100 text-red-700' : c === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{d}일</span>
                      ))
                    : <span className="text-xs text-gray-300">미신청</span>}
                </div>
              </div>
            ))}
          </div>

          {conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-sm font-bold text-red-700 mb-1">⚠️ 휴무 충돌 {conflicts.length}일</p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {conflicts.sort((a, b) => a - b).map((d) => (
                  <span key={d} className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-lg">{d}일</span>
                ))}
              </div>
              <p className="text-xs text-red-400">직원에게 다른 날로 변경 요청하세요.</p>
            </div>
          )}

          {!md.sch ? (
            <button onClick={onGenerate} disabled={!canGen}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${canGen ? 'bg-gray-900 text-white hover:bg-gray-700 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              {!canGen
                ? conflicts.length > 0
                  ? '⚠️ 충돌 해결 후 생성 가능'
                  : `휴무 신청 대기 중 (${nameA}: ${md.aOff.length}/7, ${nameB}: ${md.bOff.length}/7)`
                : '🗓 스케줄 자동 생성하기'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onReset} disabled={md.status === 'approved'}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40">
                🔄 재생성
              </button>
              {md.status === 'generated' && (
                <button onClick={onSendReview}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 active:scale-95">
                  검수 요청 →
                </button>
              )}
              {md.status === 'manager_approved' && (
                <div className="flex-1 py-3 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold text-center">검수 요청 중...</div>
              )}
              {md.status === 'approved' && (
                <div className="flex-1 py-3 rounded-2xl bg-emerald-50 text-emerald-700 text-sm font-bold text-center">✅ 최종 승인 완료</div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-3">
          {aStats && bStats && (
            <div className="grid grid-cols-2 gap-3">
              <StatGrid name={nameA} stats={aStats} accent="a" />
              <StatGrid name={nameB} stats={bStats} accent="b" />
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {md.sch ? (
              <div className="max-h-[500px] overflow-y-auto">
                <ScheduleTable sch={md.sch} nameA={nameA} nameB={nameB} year={year} month={month} />
              </div>
            ) : (
              <div className="py-10 text-center text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm">현황 탭에서 스케줄을 생성하세요</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'adjust' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold mb-3">퇴근시간 수동 조정</p>
            {!md.sch ? (
              <p className="text-sm text-gray-400">스케줄이 생성된 후 조정 가능합니다</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">직원</label>
                    <select value={adjP} onChange={(e) => setAdjP(e.target.value as 'a' | 'b')}
                      className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none">
                      <option value="a">{nameA}</option>
                      <option value="b">{nameB}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">날짜</label>
                    <select value={adjDay} onChange={(e) => setAdjDay(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none">
                      <option value="">선택</option>
                      {md.sch.filter((s) => s[adjP] !== 'off' && s[adjP] !== 'conflict').map((s) => (
                        <option key={s.day} value={s.day}>{s.day}일 ({s[adjP]})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">퇴근시간</label>
                    <input type="time" value={adjEnd} onChange={(e) => setAdjEnd(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none" />
                  </div>
                </div>
                <button
                  onClick={() => adjDay && onManualAdj(Number(adjDay), adjP, adjEnd)}
                  disabled={!adjDay}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${adjDay ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                  조정 적용
                </button>
              </div>
            )}
          </div>

          {md.sch && (() => {
            const adj = md.sch.filter((s) => s.aAdj || s.bAdj);
            return adj.length > 0 ? (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">✎ 수동 조정된 날짜</p>
                <div className="space-y-1">
                  {adj.map((s) => (
                    <div key={s.day} className="text-xs text-amber-700 flex gap-3">
                      <span className="font-bold">{s.day}일</span>
                      {s.aAdj && <span>{nameA}: ~{s.aEnd}</span>}
                      {s.bAdj && <span>{nameB}: ~{s.bEnd}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {aStats && bStats && (
            <div className="grid grid-cols-2 gap-3">
              <StatGrid name={nameA} stats={aStats} accent="a" />
              <StatGrid name={nameB} stats={bStats} accent="b" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewerView({
  year, month, nameA, nameB, md, aStats, bStats, onApprove, onReject,
}: {
  year: number; month: number; nameA: string; nameB: string;
  md: MonthData; aStats: Stats | null; bStats: Stats | null;
  onApprove: (comment: string) => void; onReject: (comment: string) => void;
}) {
  const [comment, setComment] = useState(md.comment || '');

  if (!md.sch) return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">최종 검수</h1>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-sm text-gray-500">검수할 스케줄이 없습니다</p>
        <p className="text-xs text-gray-400 mt-1">관리자가 스케줄을 생성하고 검수 요청해야 합니다</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">최종 검수</h1>

      {md.status === 'approved' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <div className="text-3xl mb-2">✅</div>
          <p className="font-bold text-emerald-700">최종 승인 완료</p>
          {md.comment && <p className="text-xs text-emerald-600 mt-1">{md.comment}</p>}
        </div>
      )}
      {md.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <div className="text-3xl mb-2">❌</div>
          <p className="font-bold text-red-700">반려됨</p>
          {md.comment && <p className="text-xs text-red-600 mt-1">{md.comment}</p>}
        </div>
      )}
      {md.status !== 'manager_approved' && md.status !== 'approved' && md.status !== 'rejected' && (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center text-sm text-gray-400">
          ⏳ 관리자의 검수 요청을 기다리고 있습니다
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-bold mb-3">📊 정산 리포트</h2>
        {aStats && bStats && (
          <div className="grid grid-cols-2 gap-3">
            <StatGrid name={nameA} stats={aStats} accent="a" />
            <StatGrid name={nameB} stats={bStats} accent="b" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-bold mb-3">📋 전체 스케줄</h2>
        <div className="max-h-[400px] overflow-y-auto">
          <ScheduleTable sch={md.sch} nameA={nameA} nameB={nameB} year={year} month={month} />
        </div>
      </div>

      {(md.status === 'manager_approved') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-bold">승인 / 반려</h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="승인 코멘트 또는 반려 사유를 입력하세요"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-gray-200"
          />
          <div className="flex gap-2">
            <button onClick={() => onApprove(comment)}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all">
              ✅ 최종 승인
            </button>
            <button onClick={() => comment && onReject(comment)} disabled={!comment}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${comment ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              ❌ 반려
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { stores, db, patchMonth, updateStore } = useScheduleStore();

  const store = stores.find((s) => s.id === storeId);

  const now = new Date();
  const [role, setRole] = useState<'employee_a' | 'employee_b' | 'manager' | 'reviewer'>('employee_a');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 text-sm">존재하지 않는 매장입니다.</p>
          <Link to="/" className="text-blue-600 text-sm mt-2 inline-block hover:underline">← 매장 목록으로</Link>
        </div>
      </div>
    );
  }

  const mk = mkKey(year, month);
  const EMPTY: MonthData = { aOff: [], bOff: [], aSub: false, bSub: false, sch: null, status: 'none', comment: '' };
  const md: MonthData = (db[storeId!] || {})[mk] || EMPTY;
  const { nameA, nameB } = store;

  const patch = (updates: Partial<MonthData>) => patchMonth(storeId!, mk, updates);

  const toggleOff = (p: 'a' | 'b', d: number) => {
    const key = p === 'a' ? 'aOff' : 'bOff';
    const sub = p === 'a' ? md.aSub : md.bSub;
    if (sub) return;
    const cur: number[] = md[key];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : cur.length < TARGET_OFF ? [...cur, d] : cur;
    patch({ [key]: next });
  };

  const submitOff = (p: 'a' | 'b') => patch(p === 'a' ? { aSub: true } : { bSub: true });
  const unsubmit = (p: 'a' | 'b') => {
    if (md.status !== 'none' && md.status !== 'rejected') return;
    patch(p === 'a' ? { aSub: false } : { bSub: false });
  };

  const conflicts = (md.aOff || []).filter((d) => (md.bOff || []).includes(d));
  const canGen = md.aOff.length === TARGET_OFF && md.bOff.length === TARGET_OFF && conflicts.length === 0;

  const generate = () => {
    if (!canGen) return;
    patch({ sch: genSchedule(year, month, md.aOff, md.bOff), status: 'generated' });
  };

  const manualAdj = (day: number, p: 'a' | 'b', newEnd: string) => {
    const s = [...(md.sch || [])];
    const i = s.findIndex((x) => x.day === day);
    if (i !== -1) s[i] = { ...s[i], [`${p}End`]: newEnd, [`${p}Adj`]: true };
    patch({ sch: s });
  };

  const aStats = md.sch ? calcStats(md.sch, 'a') : null;
  const bStats = md.sch ? calcStats(md.sch, 'b') : null;

  const prevMonth = () => { const d = new Date(year, month - 2); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); };
  const nextMonth = () => { const d = new Date(year, month); setYear(d.getFullYear()); setMonth(d.getMonth() + 1); };

  const roleTabs = [
    { id: 'employee_a' as const, label: nameA, activeCls: 'bg-amber-500 text-white' },
    { id: 'employee_b' as const, label: nameB, activeCls: 'bg-blue-500 text-white' },
    { id: 'manager' as const, label: '관리자', activeCls: 'bg-violet-600 text-white' },
    { id: 'reviewer' as const, label: '최종검수자', activeCls: 'bg-emerald-600 text-white' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm mr-1">←</Link>
            <span className="text-lg">📋</span>
            <span className="font-bold text-gray-900 text-base">{store.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">‹</button>
            <span className="text-sm font-semibold w-20 text-center">{year}. {MONTHS[month - 1]}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">›</button>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_PILL[md.status]}`}>
            {STATUS_LABEL[md.status]}
          </span>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {roleTabs.map((r) => (
            <button key={r.id} onClick={() => setRole(r.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${role === r.id ? r.activeCls : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {(role === 'employee_a' || role === 'employee_b') && (() => {
          const p = role === 'employee_a' ? 'a' : 'b';
          return (
            <EmployeeView
              p={p}
              myName={p === 'a' ? nameA : nameB}
              myOff={p === 'a' ? md.aOff : md.bOff}
              partnerOff={p === 'a' ? md.bOff : md.aOff}
              submitted={p === 'a' ? md.aSub : md.bSub}
              year={year} month={month}
              sch={md.sch}
              stats={p === 'a' ? aStats : bStats}
              nameA={nameA} nameB={nameB}
              onToggle={(d) => toggleOff(p, d)}
              onSubmit={() => submitOff(p)}
              onUnsubmit={() => unsubmit(p)}
              canUnsubmit={md.status === 'none' || md.status === 'rejected'}
            />
          );
        })()}

        {role === 'manager' && (
          <ManagerView
            year={year} month={month}
            nameA={nameA} nameB={nameB}
            onNameAChange={(v) => updateStore({ ...store, nameA: v })}
            onNameBChange={(v) => updateStore({ ...store, nameB: v })}
            md={md} conflicts={conflicts} canGen={canGen}
            aStats={aStats} bStats={bStats}
            onGenerate={generate}
            onReset={() => patch({ sch: null, status: 'none' })}
            onSendReview={() => patch({ status: 'manager_approved' })}
            onManualAdj={manualAdj}
          />
        )}

        {role === 'reviewer' && (
          <ReviewerView
            year={year} month={month} nameA={nameA} nameB={nameB}
            md={md} aStats={aStats} bStats={bStats}
            onApprove={(comment) => patch({ status: 'approved', comment })}
            onReject={(comment) => patch({ status: 'rejected', comment })}
          />
        )}
      </main>
    </div>
  );
}

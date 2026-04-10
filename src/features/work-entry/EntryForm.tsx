import { useState, useRef } from 'react';
import type { WorkEntry } from '../../types';
import { generateId } from '../../utils/id';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  initial?: WorkEntry;
  onSave: (entry: WorkEntry) => void;
  onCancel?: () => void;
}

function calcDailyDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 1440;
  return endMin - startMin;
}

export default function EntryForm({ initial, onSave, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Omit<WorkEntry, 'id'>>({
    startDate: initial?.startDate ?? today,
    endDate: initial?.endDate ?? today,
    startTime: initial?.startTime ?? '09:00',
    endTime: initial?.endTime ?? '18:00',
    breakMinutes: initial?.breakMinutes ?? 60,
    daysOfWeek: initial?.daysOfWeek ?? [],
    memo: initial?.memo ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const submittingRef = useRef(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors([]);
  }

  function handleStartDateChange(val: string) {
    setForm((f) => ({ ...f, startDate: val, endDate: f.endDate < val ? val : f.endDate }));
    setErrors([]);
  }

  function handleBreakChange(raw: string) {
    const val = Math.max(0, Math.floor(Number(raw) || 0));
    set('breakMinutes', val);
  }

  function toggleDay(day: number) {
    const days = form.daysOfWeek ?? [];
    set('daysOfWeek', days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;

    const errs: string[] = [];
    if (form.endDate < form.startDate) {
      errs.push('종료일이 시작일보다 빠릅니다.');
    }
    const duration = calcDailyDuration(form.startTime, form.endTime);
    const safeBreak = Math.max(0, Math.floor(form.breakMinutes));
    if (safeBreak >= duration) {
      errs.push(`휴게시간(${safeBreak}분)이 하루 근무시간(${duration}분)을 초과합니다.`);
    }

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    submittingRef.current = true;
    onSave({ id: initial?.id ?? generateId(), ...form, breakMinutes: safeBreak });
    submittingRef.current = false;
  }

  const inputCls = 'border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full';
  const duration = calcDailyDuration(form.startTime, form.endTime);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
          <input type="date" className={inputCls} value={form.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
          <input type="date" className={inputCls} value={form.endDate}
            min={form.startDate}
            onChange={(e) => set('endDate', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">출근 시각</label>
          <input type="time" className={inputCls} value={form.startTime}
            onChange={(e) => set('startTime', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">퇴근 시각</label>
          <input type="time" className={inputCls} value={form.endTime}
            onChange={(e) => set('endTime', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            휴게시간 (분)
            <span className="ml-1 text-gray-400 font-normal">최대 {duration - 1}분</span>
          </label>
          <input type="number" className={inputCls} value={form.breakMinutes}
            min={0} max={duration - 1} step={1}
            onChange={(e) => handleBreakChange(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input type="text" className={inputCls} value={form.memo}
            placeholder="선택사항" onChange={(e) => set('memo', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          요일 지정 <span className="text-gray-400">(비어있으면 매일)</span>
        </label>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                (form.daysOfWeek ?? []).includes(i)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
          {errors.map((err) => (
            <li key={err} className="text-xs text-red-600">{err}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
            취소
          </button>
        )}
        <button type="submit"
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">
          {initial ? '수정 완료' : '추가'}
        </button>
      </div>
    </form>
  );
}

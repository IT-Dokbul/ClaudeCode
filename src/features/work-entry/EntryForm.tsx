import { useState } from 'react';
import type { WorkEntry } from '../../types';
import { generateId } from '../../utils/id';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  initial?: WorkEntry;
  onSave: (entry: WorkEntry) => void;
  onCancel?: () => void;
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

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day: number) {
    const days = form.daysOfWeek ?? [];
    set('daysOfWeek', days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: initial?.id ?? generateId(), ...form });
  }

  const inputCls = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
          <input type="date" className={inputCls} value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
          <input type="date" className={inputCls} value={form.endDate}
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
          <label className="block text-xs font-medium text-gray-600 mb-1">휴게시간 (분)</label>
          <input type="number" className={inputCls} value={form.breakMinutes} min={0}
            onChange={(e) => set('breakMinutes', Number(e.target.value))} />
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

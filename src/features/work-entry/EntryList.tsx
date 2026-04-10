import { useState } from 'react';
import type { WorkEntry } from '../../types';
import EntryForm from './EntryForm';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  entries: WorkEntry[];
  onUpdate: (entry: WorkEntry) => void;
  onDelete: (id: string) => void;
}

export default function EntryList({ entries, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12 text-sm">
        아직 입력된 근무 항목이 없어요.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4">
          {editingId === entry.id ? (
            <EntryForm
              initial={entry}
              onSave={(updated) => { onUpdate(updated); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <div className="font-medium text-gray-800">
                  {entry.startDate} ~ {entry.endDate}
                  <span className="ml-2 text-blue-600">
                    {entry.startTime} ~ {entry.endTime}
                  </span>
                </div>
                <div className="text-gray-500">
                  휴게 {entry.breakMinutes}분
                  {entry.daysOfWeek && entry.daysOfWeek.length > 0 && (
                    <span className="ml-2">
                      [{entry.daysOfWeek.map((d) => DAY_LABELS[d]).join('·')}]
                    </span>
                  )}
                  {entry.memo && <span className="ml-2 text-gray-400">{entry.memo}</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditingId(entry.id)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  수정
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

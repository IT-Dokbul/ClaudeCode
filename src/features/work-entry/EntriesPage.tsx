import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import EntryForm from './EntryForm';
import EntryList from './EntryList';

export default function EntriesPage() {
  const [showForm, setShowForm] = useState(false);
  const { entries, addEntry, updateEntry, deleteEntry } = useAppStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">근무 입력</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          {showForm ? '닫기' : '+ 근무 추가'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">새 근무 입력</h2>
          <EntryForm
            onSave={(entry) => { addEntry(entry); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <EntryList entries={entries} onUpdate={updateEntry} onDelete={deleteEntry} />
    </div>
  );
}

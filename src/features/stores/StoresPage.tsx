import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useScheduleStore } from '../../store/useScheduleStore';
import type { StoreConfig } from '../../types/schedule';

interface FormData {
  name: string;
  operatingStart: string;
  operatingEnd: string;
  nameA: string;
  nameB: string;
}

const emptyForm: FormData = {
  name: '',
  operatingStart: '10:00',
  operatingEnd: '20:00',
  nameA: '',
  nameB: '',
};

export default function StoresPage() {
  const { stores, addStore, updateStore, deleteStore } = useScheduleStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (store: StoreConfig) => {
    setEditingId(store.id);
    setForm({
      name: store.name,
      operatingStart: store.operatingStart,
      operatingEnd: store.operatingEnd,
      nameA: store.nameA,
      nameB: store.nameB,
    });
    setError('');
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setError('');
  };

  const submit = () => {
    if (!form.name.trim()) { setError('매장 이름을 입력해주세요.'); return; }
    if (!form.nameA.trim() || !form.nameB.trim()) { setError('직원 A, B 이름을 모두 입력해주세요.'); return; }
    const data = {
      name: form.name.trim(),
      operatingStart: form.operatingStart,
      operatingEnd: form.operatingEnd,
      nameA: form.nameA.trim(),
      nameB: form.nameB.trim(),
    };
    if (editingId) {
      updateStore({ id: editingId, ...data });
    } else {
      addStore(data);
    }
    cancel();
  };

  const handleDelete = (store: StoreConfig) => {
    if (confirm(`"${store.name}" 매장을 삭제하시겠습니까?\n모든 스케줄 데이터도 함께 삭제됩니다.`)) {
      deleteStore(store.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="font-bold text-gray-900 text-base">스케줄 관리</span>
          </div>
          <button
            onClick={openAdd}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors"
          >
            + 매장 추가
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">
              {editingId ? '매장 수정' : '새 매장 추가'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">매장 이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 강남점"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">운영 시작</label>
                  <input
                    type="time"
                    value={form.operatingStart}
                    onChange={(e) => setForm({ ...form, operatingStart: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">운영 종료</label>
                  <input
                    type="time"
                    value={form.operatingEnd}
                    onChange={(e) => setForm({ ...form, operatingEnd: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-amber-600 mb-1 block font-medium">직원 A 이름</label>
                  <input
                    type="text"
                    value={form.nameA}
                    onChange={(e) => setForm({ ...form, nameA: e.target.value })}
                    placeholder="예: 김민수"
                    className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-blue-600 mb-1 block font-medium">직원 B 이름</label>
                  <input
                    type="text"
                    value={form.nameB}
                    onChange={(e) => setForm({ ...form, nameB: e.target.value })}
                    placeholder="예: 이지영"
                    className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={submit}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors"
              >
                {editingId ? '수정 완료' : '추가'}
              </button>
              <button
                onClick={cancel}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {stores.length === 0 && !showForm ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🏪</div>
            <p className="text-gray-500 text-sm font-medium">등록된 매장이 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">위의 "매장 추가" 버튼으로 시작하세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stores.map((store) => (
              <div key={store.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{store.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {store.operatingStart} ~ {store.operatingEnd}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(store)}
                      className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(store)}
                      className="text-xs px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-semibold">
                    {store.nameA}
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold">
                    {store.nameB}
                  </span>
                </div>
                <Link
                  to={`/stores/${store.id}`}
                  className="flex items-center justify-center w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  스케줄 관리 →
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/id';
import type { Store } from '../../types';

interface StoreFormData {
  name: string;
  operatingStart: string;
  operatingEnd: string;
}

const emptyForm: StoreFormData = {
  name: '',
  operatingStart: '10:00',
  operatingEnd: '20:00',
};

export default function StoresPage() {
  const { stores, employees, addStore, updateStore, deleteStore } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreFormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const employeeCount = (storeId: string) =>
    employees.filter((e) => e.storeId === storeId).length;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (store: Store) => {
    setEditingId(store.id);
    setForm({
      name: store.name,
      operatingStart: store.operatingStart,
      operatingEnd: store.operatingEnd,
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
    if (!form.name.trim()) {
      setError('매장 이름을 입력해주세요.');
      return;
    }
    if (!form.operatingStart || !form.operatingEnd) {
      setError('운영 시간을 입력해주세요.');
      return;
    }
    if (editingId) {
      updateStore({ id: editingId, ...form, name: form.name.trim() });
    } else {
      addStore({ id: generateId(), ...form, name: form.name.trim() });
    }
    cancel();
  };

  const handleDelete = (store: Store) => {
    const count = employeeCount(store.id);
    const msg =
      count > 0
        ? `"${store.name}" 매장을 삭제하면 소속 직원 ${count}명도 함께 삭제됩니다. 계속하시겠습니까?`
        : `"${store.name}" 매장을 삭제하시겠습니까?`;
    if (confirm(msg)) deleteStore(store.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">매장 관리</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 매장 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editingId ? '매장 수정' : '새 매장 추가'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">매장 이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 강남점"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">운영 시작</label>
              <input
                type="time"
                value={form.operatingStart}
                onChange={(e) => setForm({ ...form, operatingStart: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">운영 종료</label>
              <input
                type="time"
                value={form.operatingEnd}
                onChange={(e) => setForm({ ...form, operatingEnd: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={submit}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editingId ? '수정 완료' : '추가'}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {stores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">등록된 매장이 없습니다.</p>
          <p className="text-sm mt-1">위의 "매장 추가" 버튼으로 매장을 등록하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stores.map((store) => (
            <div
              key={store.id}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{store.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    운영 시간: {store.operatingStart} ~ {store.operatingEnd}
                  </p>
                  <p className="text-sm text-gray-500">
                    직원 {employeeCount(store.id)}명
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(store)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(store)}
                    className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <Link
                to={`/stores/${store.id}`}
                className="mt-4 flex items-center justify-center w-full py-2 bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 font-medium rounded-lg transition-colors border border-gray-200"
              >
                직원 관리 →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

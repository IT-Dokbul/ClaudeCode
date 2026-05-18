import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { generateId } from '../../utils/id';
import type { Employee } from '../../types';

interface EmployeeFormData {
  name: string;
  contractHoursPerDay: string;
  monthlyDaysOff: string;
}

const emptyForm: EmployeeFormData = {
  name: '',
  contractHoursPerDay: '9.5',
  monthlyDaysOff: '7',
};

export default function EmployeesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { stores, employees, addEmployee, updateEmployee, deleteEmployee } = useAppStore();

  const store = stores.find((s) => s.id === storeId);
  const storeEmployees = employees.filter((e) => e.storeId === storeId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  if (!store) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">존재하지 않는 매장입니다.</p>
        <Link to="/stores" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
          ← 매장 목록으로
        </Link>
      </div>
    );
  }

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      name: emp.name,
      contractHoursPerDay: String(emp.contractHoursPerDay),
      monthlyDaysOff: String(emp.monthlyDaysOff),
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
      setError('직원 이름을 입력해주세요.');
      return;
    }
    const contractHours = parseFloat(form.contractHoursPerDay);
    if (isNaN(contractHours) || contractHours <= 0) {
      setError('계약 근무시간을 올바르게 입력해주세요.');
      return;
    }
    const daysOff = parseInt(form.monthlyDaysOff, 10);
    if (isNaN(daysOff) || daysOff < 0) {
      setError('월 휴무일을 올바르게 입력해주세요.');
      return;
    }
    if (editingId) {
      updateEmployee({
        id: editingId,
        storeId: storeId!,
        name: form.name.trim(),
        contractHoursPerDay: contractHours,
        monthlyDaysOff: daysOff,
      });
    } else {
      addEmployee({
        id: generateId(),
        storeId: storeId!,
        name: form.name.trim(),
        contractHoursPerDay: contractHours,
        monthlyDaysOff: daysOff,
      });
    }
    cancel();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link to="/stores" className="text-sm text-gray-500 hover:text-gray-700">
          ← 매장 목록
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6 mt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{store.name} — 직원 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            운영 시간: {store.operatingStart} ~ {store.operatingEnd}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 직원 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editingId ? '직원 수정' : '새 직원 추가'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 홍길동"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                일 계약근무시간 (h)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={form.contractHoursPerDay}
                onChange={(e) => setForm({ ...form, contractHoursPerDay: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                월 휴무일 수 (일)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="31"
                value={form.monthlyDaysOff}
                onChange={(e) => setForm({ ...form, monthlyDaysOff: e.target.value })}
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

      {storeEmployees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">등록된 직원이 없습니다.</p>
          <p className="text-sm mt-1">위의 "직원 추가" 버튼으로 직원을 등록하세요.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">이름</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  일 계약근무시간
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">월 휴무일</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">월 계약시간</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {storeEmployees.map((emp, i) => {
                const now = new Date();
                const daysInMonth = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  0,
                ).getDate();
                const monthlyContractHours =
                  (daysInMonth - emp.monthlyDaysOff) * emp.contractHoursPerDay;
                return (
                  <tr
                    key={emp.id}
                    className={i < storeEmployees.length - 1 ? 'border-b border-gray-100' : ''}
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">{emp.name}</td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {emp.contractHoursPerDay}h
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {emp.monthlyDaysOff}일
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">
                      이번달 {monthlyContractHours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`"${emp.name}" 직원을 삭제하시겠습니까?`))
                              deleteEmployee(emp.id);
                          }}
                          className="text-xs px-3 py-1.5 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

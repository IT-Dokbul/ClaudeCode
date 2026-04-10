import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { PayrollSettings } from '../../types';

export default function SettingsPage() {
  const { settings, saveSettings } = useAppStore();
  const [form, setForm] = useState<PayrollSettings>({ ...settings });
  const [saved, setSaved] = useState(false);

  function set<K extends keyof PayrollSettings>(key: K, value: PayrollSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    const defaults: PayrollSettings = {
      nightBonusRate: 0.5,
      overtimeBonusRate: 0.5,
      weeklyHolidayPay: false,
      nightStartHour: 22,
      nightEndHour: 6,
      dailyWorkLimit: 8,
      currency: 'KRW',
    };
    setForm(defaults);
  }

  const inputCls = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-28';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">설정</h1>

      <form onSubmit={handleSave} className="space-y-5 max-w-lg">

        {/* 연장근무 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">연장 근무</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">일일 기본 근무시간</p>
              <p className="text-xs text-gray-400">이 시간 초과 시 연장 근무로 처리</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.dailyWorkLimit} min={1} max={24}
                onChange={(e) => set('dailyWorkLimit', Number(e.target.value))} />
              <span className="text-sm text-gray-500">시간</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">연장 근무 가산율</p>
              <p className="text-xs text-gray-400">한국 법정 기준 50%</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.overtimeBonusRate * 100} min={0} max={200}
                onChange={(e) => set('overtimeBonusRate', Number(e.target.value) / 100)} />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </div>

        {/* 야간 근무 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">야간 근무</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">야간 시작 시각</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.nightStartHour} min={0} max={23}
                onChange={(e) => set('nightStartHour', Number(e.target.value))} />
              <span className="text-sm text-gray-500">시</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">야간 종료 시각</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.nightEndHour} min={0} max={23}
                onChange={(e) => set('nightEndHour', Number(e.target.value))} />
              <span className="text-sm text-gray-500">시</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">야간 가산율</p>
              <p className="text-xs text-gray-400">한국 법정 기준 50%</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.nightBonusRate * 100} min={0} max={200}
                onChange={(e) => set('nightBonusRate', Number(e.target.value) / 100)} />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </div>

        {/* 주휴수당 */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">주휴수당</h2>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-gray-700">주휴수당 적용</p>
              <p className="text-xs text-gray-400">주 15시간 이상 근무 시 유급 휴일 1일 지급 (Phase 4 계산 예정)</p>
            </div>
            <div
              onClick={() => set('weeklyHolidayPay', !form.weeklyHolidayPay)}
              className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${form.weeklyHolidayPay ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${form.weeklyHolidayPay ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="submit"
            className="px-5 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">
            {saved ? '저장됨 ✓' : '저장'}
          </button>
          <button type="button" onClick={handleReset}
            className="px-5 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
            기본값으로
          </button>
        </div>
      </form>
    </div>
  );
}

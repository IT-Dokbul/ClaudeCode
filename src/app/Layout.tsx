import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: '대시보드', end: true },
  { to: '/entries', label: '근무 입력' },
  { to: '/payroll', label: '급여 결과' },
  { to: '/wages', label: '시급 관리' },
  { to: '/settings', label: '설정' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-6 h-14">
          <span className="font-bold text-blue-600 text-lg shrink-0">급여 계산기</span>
          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet } from 'react-router-dom';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout({ onLogout }: { onLogout?: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <h1 className="text-base font-semibold">QA App</h1>
            <p className="text-xs text-slate-500">Test Yönetim Uygulaması</p>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/dashboard" className={linkClass}>
              Genel Bakış
            </NavLink>
            <NavLink to="/test-cases" className={linkClass}>
              Test Case'ler
            </NavLink>
            <NavLink to="/test-suites" className={linkClass}>
              Suite'ler
            </NavLink>
            <NavLink to="/test-runs" className={linkClass}>
              Run'lar
            </NavLink>
            <NavLink to="/scenarios" className={linkClass}>
              Senaryolar
            </NavLink>
            <NavLink to="/scenario-templates" className={linkClass}>
              Şablonlar
            </NavLink>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
                data-testid="logout"
              >
                Çıkış
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

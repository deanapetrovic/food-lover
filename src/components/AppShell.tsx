import { NavLink, Outlet, Link } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Dishes', end: true },
  { to: '/want', label: 'Want' },
  { to: '/map', label: 'Map' },
  { to: '/lists', label: 'Lists' },
]

export function AppShell() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col md:flex-row-reverse">
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0"><Outlet /></main>
      <nav aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:static md:w-40 md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:p-4">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `px-3 py-3 text-sm font-medium ${isActive ? 'text-accent' : 'text-muted'}`}>
            {t.label}
          </NavLink>
        ))}
        <Link to="/log" aria-label="Log a dish"
          className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-accent text-3xl text-on-accent shadow-lg md:mt-0 md:h-auto md:w-full md:rounded-xl md:py-2 md:text-base">
          <span aria-hidden className="md:hidden">+</span><span className="hidden md:inline">+ Log dish</span>
        </Link>
      </nav>
    </div>
  )
}

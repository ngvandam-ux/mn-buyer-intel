import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const I = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true, icon: I('M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z') },
  { to: '/buyers', label: 'Buyers', icon: I('M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01') },
  { to: '/opportunities', label: 'Opportunities', icon: I('M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h6') },
  { to: '/contacts', label: 'Contacts', icon: I('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75') },
  { to: '/signals', label: 'Signals', icon: I('M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0 .01') },
  { to: '/budget', label: 'Budget Intel', icon: I('M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6') },
  { to: '/matching', label: 'Seller Matching', icon: I('M12 2l2.5 6.5L21 9l-5 4 1.5 7L12 16.5 6.5 20 8 13 3 9l6.5-.5z') },
];

const ADMIN: NavItem[] = [
  { to: '/sources', label: 'Source Health', icon: I('M22 12h-4l-3 9L9 3l-3 9H2') },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/buyers': 'Buyer Map & Entity Explorer',
  '/opportunities': 'Opportunities',
  '/contacts': 'Contacts',
  '/signals': 'Buying Signals',
  '/budget': 'Budget Intel',
  '/matching': 'Seller Profile & Matching',
  '/sources': 'Source Health & Refresh Logs',
};

export function Layout() {
  const { pathname } = useLocation();
  const base = `/${pathname.split('/')[1] ?? ''}`;
  const title = TITLES[base] ?? TITLES['/'];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">MN</div>
          <div>
            <div className="name">Buyer Intelligence</div>
            <div className="sub">Minnesota public sector</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <div className="section-label">Admin</div>
          {ADMIN.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Evidence-first procurement intelligence. Every field traces to a public source.
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="title">{title}</div>
            <div className="crumb">State of Minnesota · agencies · cities · counties · public safety · higher ed · cooperatives</div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

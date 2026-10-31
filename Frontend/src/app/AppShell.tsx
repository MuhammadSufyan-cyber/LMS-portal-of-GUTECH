import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

const roleName = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };

type IconName =
  | 'dashboard'
  | 'users'
  | 'audit'
  | 'courses'
  | 'attendance'
  | 'complaints'
  | 'marks'
  | 'sparkles'
  | 'chevron'
  | 'logout';

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    focusable: false as const,
  };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="5" rx="1" />
          <rect x="13" y="10" width="8" height="11" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'audit':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" />
          <path d="M9 2h6v4H9z" />
        </svg>
      );
    case 'courses':
      return (
        <svg {...common}>
          <path d="M12 7v14M3 18V5a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a4 4 0 0 0-4 2 4 4 0 0 0-4-2H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'attendance':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18M8 15l2.5 2.5L16 12" />
        </svg>
      );
    case 'complaints':
      return (
        <svg {...common}>
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );
    case 'marks':
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3zM19 14l1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14z" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
      );
  }
}
export default function AppShell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  const links =
    profile.role === 'admin'
      ? [
          { to: '/admin', label: 'Overview', icon: 'dashboard' as const },
          { to: '/admin/users', label: 'People', icon: 'users' as const },
          { to: '/admin/audit', label: 'Audit log', icon: 'audit' as const },
          { to: '/admin/courses', label: 'Courses', icon: 'courses' as const },
          { to: '/attendance', label: 'Attendance', icon: 'attendance' as const },
          { to: '/complaints', label: 'Complaints', icon: 'complaints' as const },
        ]
      : [
          { to: `/${profile.role}`, label: 'Overview', icon: 'dashboard' as const },
          {
            to: `/${profile.role}/courses`,
            label: profile.role === 'teacher' ? 'My classes' : 'My courses',
            icon: 'courses' as const,
          },
          { to: '/complaints', label: 'Complaints', icon: 'complaints' as const },
          { to: '/attendance', label: 'Attendance', icon: 'attendance' as const },
          ...(profile.role === 'student'
            ? [{ to: '/marks', label: 'My marks', icon: 'marks' as const }]
            : []),
        ];
  const leave = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand brand-light">
          <span className="brand-mark">G</span>
          <span>
            GUTECH<span className="brand-muted"> / LEARN</span>
          </span>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              end
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? ' nav-active' : ''}`}
            >
              <span className="nav-icon">
                <Icon name={link.icon} />
              </span>
              {link.label}
              {link.label === 'People' && (
                <span className="nav-arrow">
                  <Icon name="chevron" size={15} />
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-icon">
              <Icon name="sparkles" size={17} />
            </span>
            <div>
              <strong>Learning in motion</strong>
              <small>Your campus, connected.</small>
            </div>
          </div>
          <div className="account-mini">
            <span className="avatar avatar-mini">
              {profile.fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join('')}
            </span>
            <span className="account-text">
              <strong>{profile.fullName}</strong>
              <small>{roleName[profile.role]}</small>
            </span>
            <button
              className="icon-button icon-button-dark"
              onClick={leave}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>GUTECH</span>
            <i>/</i>
            <strong>{profile.role === 'admin' ? 'Administration' : roleName[profile.role]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="campus-indicator">
              <i /> CAMPUS PORTAL
            </span>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `profile-button${isActive ? ' profile-button-active' : ''}`
              }
            >
              <span className="avatar avatar-top">
                {profile.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join('')}
              </span>
              <span className="profile-button-label">My profile</span>
            </NavLink>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function MountainWordmark() {
  return (
    <img 
      src="/logo-tarapeak.png" 
      alt="TaraPeak Logo" 
      className="h-8 w-auto object-contain" 
    />
  );
}

export default function AdminNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin', end: true },
    { label: 'Trail Reports', path: '/admin/reports', end: false },
    { label: 'User Accounts', path: '/admin/users', end: false },
  ];

  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-desktop py-base max-w-full">
        <div className="flex items-center gap-gutter">
          <Link
            to="/admin"
            className="inline-flex outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <MountainWordmark />
          </Link>
          
          <nav className="hidden md:flex items-center gap-md">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `font-label-md text-label-md flex items-center gap-1.5 transition-colors py-1 ${
                    isActive
                      ? 'text-primary font-semibold border-b-2 border-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-md">
          <div className="flex items-center gap-sm">
            {user ? (
              <div className="flex items-center gap-sm">
                <span className="hidden sm:inline font-label-md text-label-md text-on-surface-variant">
                  {user.first_name} {user.last_name}
                </span>
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Log out"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary focus:outline-none"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined">
                      logout
                    </span>
                  </button>

                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block bg-surface-container-high text-on-surface font-label-sm text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                    Log out
                  </div>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                aria-label="Log in"
                className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary"
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  account_circle
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
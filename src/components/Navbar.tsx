import { Link, useLocation, useNavigate } from 'react-router-dom';
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

function ComingSoonLink({ label }: { label: string }) {
  return (
    <span
      aria-disabled="true"
      className="flex items-center gap-1 text-on-surface-variant/50 font-label-md text-label-md cursor-not-allowed"
    >
      {label}
      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70">
        Soon
      </span>
    </span>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const isActive = pathname === to;
  return (
    <Link
      to={to}
      className={
        isActive
          ? 'text-primary font-label-md text-label-md border-b-2 border-primary pb-1 outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
          : 'text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      }
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-desktop py-base max-w-full">
        <div className="flex items-center gap-gutter">
          <Link
            to="/"
            className="inline-flex outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <MountainWordmark />
          </Link>
          <nav className="hidden md:flex items-center gap-md">
            <NavLink to="/" label="Explore" />
            <NavLink to="/dashboard" label="Dashboard" />
            <NavLink to="/plans" label="Plans" />
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-sm">
            <span
              aria-hidden="true"
              className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors"
            >
              notifications
            </span>
            {user ? (
              <div className="flex items-center gap-sm">
                <span className="hidden sm:inline font-label-md text-label-md text-on-surface-variant">
                  {user.first_name}
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

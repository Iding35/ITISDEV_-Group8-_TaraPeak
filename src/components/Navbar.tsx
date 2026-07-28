import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../api';
import { useAuth } from '../context/AuthContext';

/** Keeps the bell badge roughly in step with the dashboard's own polling. */
const UNREAD_POLL_MS = 30_000;

/** Don't start retracting until the bar has been scrolled fully past. */
const RETRACT_AFTER_PX = 80;
/** Ignore scroll jitter below this delta so the bar doesn't flicker. */
const SCROLL_DELTA_PX = 6;

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function CompassIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
      <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
    </svg>
  );
}

function MountainIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 20h18L14.2 6.6a1.4 1.4 0 0 0-2.4 0l-2.6 5.1" />
      <path d="m3 20 4.6-7.2a1.3 1.3 0 0 1 2.2 0L12 16" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9.5 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3.5" />
      <path d="m15.5 15.5 4-3.5-4-3.5M19.5 12H9.5" />
    </svg>
  );
}

const NAV_ITEMS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Explore', icon: <CompassIcon /> },
  { to: '/planner', label: 'Plan a Hike', icon: <MountainIcon /> },
  { to: '/dashboard', label: 'Dashboard', icon: <GridIcon /> }
  
];

function useCompactNav() {
  const [compact, setCompact] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function evaluate() {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (Math.abs(delta) > SCROLL_DELTA_PX) {
        setCompact(delta > 0 && y > RETRACT_AFTER_PX);
        lastY.current = y;
      }
      ticking.current = false;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(evaluate);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return compact;
}

function MountainWordmark() {
  return (
    <img
      src="/logo-tarapeak.png"
      alt="TaraPeak"
      className="h-11 w-auto origin-left object-contain transition-transform duration-200 ease-out group-hover:scale-105 group-focus-visible:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
    />
  );
}

export function ComingSoonLink({ label }: { label: string }) {
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

const ICON_BUTTON =
  'relative flex h-touch w-touch items-center justify-center rounded-xl text-on-surface-variant outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const TOOLTIP =
  'pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-inverse-surface px-2 py-1 font-label-sm text-xs text-inverse-on-surface opacity-0 shadow-md transition-opacity duration-150 motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100';

/** Icon button that renders as a link or a button, with a hover/focus tooltip. */
function IconAction({
  label,
  children,
  to,
  onClick,
}: {
  label: string;
  children: ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  return (
    <div className="relative group">
      {to ? (
        <Link to={to} aria-label={label} className={ICON_BUTTON}>
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} className={ICON_BUTTON}>
          {children}
        </button>
      )}
      <span role="tooltip" className={TOOLTIP}>
        {label}
      </span>
    </div>
  );
}

/**
 * Nav item showing its icon with the label beside it. Scrolling down collapses
 * the label to zero width, leaving the icon; scrolling up brings it back.
 * The label is always in the DOM, so it stays available to screen readers and
 * the collapse animates instead of popping.
 */
function NavLink({
  to,
  label,
  icon,
  compact,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  compact: boolean;
}) {
  const { pathname } = useLocation();
  const isActive = pathname === to;

  return (
    <div className="relative group">
      <Link
        to={to}
        aria-current={isActive ? 'page' : undefined}
        className={`flex h-touch items-center justify-center rounded-xl px-3 outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
        }`}
      >
        <span className="shrink-0">{icon}</span>
        {/* Below md the label stays collapsed at every scroll position, so the
            centred nav can't outgrow a narrow viewport. */}
        <span
          className={`overflow-hidden whitespace-nowrap font-label-md text-label-md transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none ${
            compact
              ? 'ml-0 max-w-0 opacity-0'
              : 'ml-0 max-w-0 opacity-0 md:ml-2 md:max-w-[9rem] md:opacity-100'
          }`}
        >
          {label}
        </span>
      </Link>

      <span
        role="tooltip"
        className={`${TOOLTIP} ${
          compact ? '' : 'md:group-hover:opacity-0 md:group-focus-within:opacity-0'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const compact = useCompactNav();

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;

    function loadUnread() {
      fetchNotifications()
        .then((feed) => {
          if (!cancelled) setUnreadCount(feed.unread_count);
        })
        .catch(() => {
          // Badge is non-critical; leave the last known count in place.
        });
    }

    loadUnread();
    const timer = setInterval(loadUnread, UNREAD_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const notificationLabel =
    unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      {/* Three tracks so the nav sits on the true centre of the bar. With
          justify-between the nav's position drifts with the logo's width. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center h-header w-full px-margin-desktop">
        <Link
          to="/"
          aria-label="TaraPeak home"
          className="group justify-self-start inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <MountainWordmark />
        </Link>

        {/* Icons are compact enough to keep the nav on small screens too. */}
        <nav aria-label="Main" className="flex items-center gap-base justify-self-center">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              compact={compact}
            />
          ))}
        </nav>

        <div className="flex items-center gap-base justify-self-end">
          {user && (
            <IconAction to="/dashboard" label={notificationLabel}>
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </IconAction>
          )}

          {user ? (
            <>
              <span className="hidden sm:inline font-label-md text-label-md text-on-surface-variant">
                {user.first_name}
              </span>
              <IconAction label="Log out" onClick={handleLogout}>
                <LogoutIcon />
              </IconAction>
            </>
          ) : (
            <IconAction to="/login" label="Log in">
              <UserIcon />
            </IconAction>
          )}
        </div>
      </div>
    </header>
  );
}

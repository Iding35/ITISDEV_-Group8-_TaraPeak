import { Link, useLocation } from 'react-router-dom';

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

export default function Navbar() {
  const { pathname } = useLocation();
  const isExploreActive = pathname === '/';

  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-desktop py-base max-w-full">
        <div className="flex items-center gap-gutter">
          <Link
            to="/"
            className="font-headline-md text-headline-md font-bold text-primary outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            TaraPeak
          </Link>
          <nav className="hidden md:flex items-center gap-md">
            <Link
              to="/"
              className={
                isExploreActive
                  ? 'text-primary font-label-md text-label-md border-b-2 border-primary pb-1 outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
                  : 'text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
              }
            >
              Explore
            </Link>
            <ComingSoonLink label="Dashboard" />
            <ComingSoonLink label="Plans" />
          </nav>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
              notifications
            </span>
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
              account_circle
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

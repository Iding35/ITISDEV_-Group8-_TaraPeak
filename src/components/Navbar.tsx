import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="flex justify-between items-center w-full px-margin-desktop py-base max-w-full">
        <div className="flex items-center gap-gutter">
          <Link to="/" className="font-headline-md text-headline-md font-bold text-primary">
            TaraPeak
          </Link>
          <nav className="hidden md:flex gap-md">
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors"
              href="#"
            >
              Dashboard
            </a>
            <Link to="/" className="text-primary font-label-md text-label-md border-b-2 border-primary pb-1">
              Map View
            </Link>
            <a
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors"
              href="#"
            >
              Plans
            </a>
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

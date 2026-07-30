import Navbar, { GridIcon, iconProps, type NavItem } from './Navbar';

function ReportIcon() {
  return (
    <svg {...iconProps}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3" />
      <path d="M8.5 11.5h7M8.5 15h7M8.5 18.5h4" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 9.5a2.5 2.5 0 1 0 0-5" />
      <path d="M15 13.2c2.7.4 4.5 2.2 4.9 4.8" />
    </svg>
  );
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <GridIcon /> },
  { to: '/admin/reports', label: 'Trail Reports', icon: <ReportIcon /> },
  { to: '/admin/users', label: 'User Accounts', icon: <PeopleIcon /> },
];

/**
 * Same navbar as every hiker-facing page — scroll-collapsing icon nav,
 * notification bell, logo hover-zoom — just admin's own tabs and a logo
 * that goes to /admin instead of /. See Navbar.tsx for the shared behavior.
 */
export default function AdminNavbar() {
  return (
    <Navbar
      items={ADMIN_NAV_ITEMS}
      homeHref="/admin"
      homeLabel="TaraPeak admin home"
      logoutRedirect="/login"
    />
  );
}

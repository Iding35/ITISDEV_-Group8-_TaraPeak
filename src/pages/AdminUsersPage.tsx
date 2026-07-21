import { useEffect, useState } from 'react';
import AdminNavbar from '../components/AdminNavbar';
import { fetchAdminUsers, type AdminUserView } from '../api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await fetchAdminUsers();
        setUsers(data);
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const getUserRole = (role?: string) => {
    if (!role || role.toLowerCase() === 'user') return 'hiker';
    return role.toLowerCase();
  };

  // Filter users by selected role tab AND search query
  const filteredUsers = users.filter((u) => {
    const matchesRole = selectedRole === 'all' || getUserRole(u.role) === selectedRole.toLowerCase();
    
    const query = searchQuery.toLowerCase().trim();
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    const email = u.email.toLowerCase();
    const userIdStr = String(u.user_id);

    const matchesSearch = 
      query === '' || 
      fullName.includes(query) || 
      email.includes(query) || 
      userIdStr.includes(query);

    return matchesRole && matchesSearch;
  });

  const roles = [
    { id: 'all', label: 'All Users' },
    { id: 'hiker', label: 'Hikers' },
    { id: 'admin', label: 'Administrators' },
  ];

  return (
    <div className="bg-background min-h-screen text-gray-800">
      <AdminNavbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-primary mb-2">User Accounts Management</h1>
        <p className="text-sm text-gray-500 mb-6">Inspect, filter, and manage registered user accounts and permissions.</p>

        {/* Search Bar & Role Tabs Container */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-b border-gray-200 mb-6 pb-4">
          
          {/* Role Selection Tabs */}
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedRole === r.id
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-600 border border-gray-100 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="w-full sm:w-72 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or ID..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs text-slate-800 font-medium placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all"
            />
          </div>

        </div>

        {/* Users Content Area */}
        {loading ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading user accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-gray-100 text-center text-sm text-gray-500">
            No user accounts found matching your search or filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredUsers.map((u) => {
              const normalizedRole = getUserRole(u.role);
              return (
                <div
                  key={u.user_id}
                  className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-3 hover:border-gray-200 transition-colors"
                >
                  {/* User ID & Role */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-extrabold text-slate-900">#{u.user_id}</span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        normalizedRole === 'admin'
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {normalizedRole}
                    </span>
                  </div>

                  {/* Name Row */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {u.first_name} {u.last_name}
                    </h4>
                  </div>

                  {/* Email & Join Date */}
                  <div className="flex justify-between items-end pt-2 border-t border-gray-50 text-xs">
                    <div className="truncate max-w-[65%]">
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">EMAIL ADDRESS</span>
                      <span className="font-medium text-slate-800">{u.email}</span>
                    </div>
                    <span className="font-medium text-amber-800 shrink-0">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearToken,
  fetchCurrentUser,
  login as apiLogin,
  signup as apiSignup,
  setToken,
  type User,
} from '../api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: { first_name: string; last_name: string; email: string; password: string; hiker_experience: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const { token, user: loggedInUser } = await apiLogin({ email, password });
    setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function signup(data: { first_name: string; last_name: string; email: string; password: string; hiker_experience: string; }): Promise<User> {
    const { token, user: newUser } = await apiSignup(data);
    setToken(token);
    setUser(newUser);
    return newUser;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
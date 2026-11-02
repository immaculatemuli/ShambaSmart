import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, configureAuth } from './api';
import { cancelReminders } from './reminders';
import { getItem, removeItem, setItem } from './storage';
import type { User } from './types';

// Farmers stay signed in (the token lasts 30 days on the server); signing out forgets it on this device.
const SESSION_KEY = 'shambasmart.session';

interface Session {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string, county: string | null) => Promise<void>;
  /** Replaces the signed-in farmer's details after a change on the server (name, county). */
  updateUser: (user: User) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const save = useCallback(async (next: Session | null) => {
    configureAuth(next?.token ?? null);
    setSession(next);
    if (next) await setItem(SESSION_KEY, JSON.stringify(next));
    else await removeItem(SESSION_KEY);
  }, []);

  const signOut = useCallback(async () => {
    await cancelReminders();
    await save(null);
  }, [save]);

  useEffect(() => {
    configureAuth(null, () => void signOut());
    (async () => {
      const raw = await getItem(SESSION_KEY);
      const saved = raw ? (JSON.parse(raw) as Session) : null;
      if (saved) {
        configureAuth(saved.token);
        setSession(saved);
        // Fresh details in the background (a 401 here signs out through the handler above).
        api<{ user: User }>('/me')
          .then(({ user }) => save({ token: saved.token, user }))
          .catch(() => {});
      }
      setLoading(false);
    })();
  }, [save, signOut]);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      await save(await api<Session>('/auth/login', { method: 'POST', body: { phone, password } }));
    },
    [save],
  );

  const register = useCallback(
    async (name: string, phone: string, password: string, county: string | null) => {
      await save(await api<Session>('/auth/register', { method: 'POST', body: { name, phone, password, county } }));
    },
    [save],
  );

  const updateUser = useCallback(
    (user: User) => {
      if (session) void save({ token: session.token, user });
    },
    [session, save],
  );

  const value = useMemo(
    () => ({ user: session?.user ?? null, loading, signIn, register, updateUser, signOut }),
    [session, loading, signIn, register, updateUser, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}

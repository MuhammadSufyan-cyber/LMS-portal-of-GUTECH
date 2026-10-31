import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, jsonBody, setAccessToken, setSessionRole } from '../../lib/api';
import type { Profile } from './auth.types';

interface AuthContextValue {
  profile: Profile | null;
  ready: boolean;
  signIn(identifier: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  updateProfile(profile: Profile): void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiRequest<{ accessToken: string; profile: Profile }>('/auth/refresh', { method: 'POST' }, null)
      .then((session) => {
        if (!cancelled) {
          setAccessToken(session.accessToken);
          setSessionRole(session.profile.role);
          setProfile(session.profile);
        }
      })
      .catch(() => {
        setAccessToken(null);
        setSessionRole(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    const session = await apiRequest<{ accessToken: string; profile: Profile }>(
      '/auth/login',
      { method: 'POST', body: jsonBody({ email: identifier, password }) },
      null,
    );
    setAccessToken(session.accessToken);
    setSessionRole(session.profile.role);
    setProfile(session.profile);
    return session.profile;
  }, []);
  const signOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setSessionRole(null);
      setProfile(null);
    }
  }, []);
  const updateProfile = useCallback((next: Profile) => setProfile(next), []);
  const value = useMemo(
    () => ({ profile, ready, signIn, signOut, updateProfile }),
    [profile, ready, signIn, signOut, updateProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

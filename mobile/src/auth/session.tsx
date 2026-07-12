import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { clearTokens, getTokens, setUnauthorizedHandler } from "../api/client";
import { fetchMe, login, logout } from "../api/endpoints";
import type { User } from "../api/types";

const USER_KEY = "economat.user";

type SessionState = {
  user: User | null;
  ready: boolean;
  signIn: (serverUrl: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState>({
  user: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    // Best-effort server-side logout first (frees the single-session lock
    // immediately, matching the web app); local sign-out proceeds regardless.
    try {
      await logout();
    } catch {
      // offline or already expired — local cleanup below is what matters
    }
    await clearTokens();
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      void AsyncStorage.removeItem(USER_KEY);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore the session on cold start: cached user first (instant),
  // then a /me refresh in the background to confirm the token still works.
  useEffect(() => {
    void (async () => {
      try {
        const { access } = await getTokens();
        const cached = await AsyncStorage.getItem(USER_KEY);
        if (access && cached) {
          setUser(JSON.parse(cached) as User);
          void fetchMe()
            .then((fresh) => {
              setUser(fresh);
              void AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
            })
            .catch(() => {
              // offline or expired; the unauthorized handler deals with 401s
            });
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = useCallback(async (serverUrl: string, email: string, password: string) => {
    const freshUser = await login(serverUrl, email, password);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    setUser(freshUser);
  }, []);

  return (
    <SessionContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

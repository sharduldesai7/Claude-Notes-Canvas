import { useState, useEffect, useCallback, useRef } from "react";
import { setGuestToken } from "@workspace/api-client-react";

const STORAGE_KEY = "synaptica_guest_session";
const SESSION_DURATION_MS = 30 * 60 * 1000;

interface StoredSession {
  token: string;
  expiresAt: string;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface GuestSession {
  token: string;
  expiresAt: Date;
  secondsRemaining: number;
}

interface UseGuestSessionReturn {
  isGuest: boolean;
  session: GuestSession | null;
  isExpired: boolean;
  startGuestSession: () => Promise<{ token: string; mapId?: number }>;
  clearSession: () => void;
}

export function useGuestSession(): UseGuestSessionReturn {
  // Initialize synchronously from sessionStorage to avoid flash-redirect AND
  // set the module-level guest token before any React Query hooks fire.
  const [session, setSession] = useState<GuestSession | null>(() => {
    const stored = readStoredSession();
    if (!stored) return null;
    const expiresAt = new Date(stored.expiresAt);
    const secondsRemaining = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
    if (secondsRemaining === 0) return null;
    setGuestToken(stored.token); // Set eagerly so queries attach the header from the first render
    return { token: stored.token, expiresAt, secondsRemaining };
  });
  const [isExpired, setIsExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((expiresAt: Date, token: string) => {
    stopTimer();
    const update = () => {
      const remaining = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000));
      setSession({ token, expiresAt, secondsRemaining: remaining });
      if (remaining === 0) {
        stopTimer();
        setIsExpired(true);
        setGuestToken(null);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
  }, [stopTimer]);

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      const expiresAt = new Date(stored.expiresAt);
      setGuestToken(stored.token);
      startTimer(expiresAt, stored.token);
    }
    return stopTimer;
  }, [startTimer, stopTimer]);

  const startGuestSession = useCallback(async (): Promise<{ token: string; mapId?: number }> => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/guest-sessions`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to start guest session");
    const data = (await res.json()) as { token: string; expiresAt: string };
    const { token, expiresAt: expiresAtStr } = data;
    const expiresAt = new Date(expiresAtStr);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt: expiresAtStr }));
    setGuestToken(token);
    setIsExpired(false);
    startTimer(expiresAt, token);
    return { token };
  }, [startTimer]);

  const clearSession = useCallback(() => {
    const stored = readStoredSession();
    if (stored) {
      fetch(`${import.meta.env.BASE_URL}api/guest-sessions/${stored.token}`, { method: "DELETE" }).catch(() => {});
    }
    setGuestToken(null);
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setIsExpired(false);
    stopTimer();
  }, [stopTimer]);

  return {
    isGuest: session !== null && !isExpired,
    session,
    isExpired,
    startGuestSession,
    clearSession,
  };
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

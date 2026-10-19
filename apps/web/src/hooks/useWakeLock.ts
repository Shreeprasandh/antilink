'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Screen Wake Lock hook to prevent mobile device display from sleeping
 * Automatically re-acquires lock on visibility change (tab refocus / device unlock).
 */
export function useWakeLock() {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const wakeLockSentinelRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      setIsSupported(true);
    }
  }, []);

  const requestLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return false;

    try {
      if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
        setIsLocked(true);
        return true;
      }

      const sentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      setIsLocked(true);

      sentinel.addEventListener('release', () => {
        setIsLocked(false);
        wakeLockSentinelRef.current = null;
      });

      return true;
    } catch {
      setIsLocked(false);
      return false;
    }
  }, []);

  const releaseLock = useCallback(async () => {
    if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch {
        // ignore
      }
      wakeLockSentinelRef.current = null;
    }
    setIsLocked(false);
  }, []);

  // Automatically acquire lock on mount and maintain across visibility change
  useEffect(() => {
    if (!isSupported) return;

    requestLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [isSupported, requestLock, releaseLock]);

  return {
    isLocked,
    isSupported,
    requestLock,
    releaseLock,
  };
}

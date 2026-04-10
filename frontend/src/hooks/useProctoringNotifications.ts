import { useEffect, useRef, useCallback } from 'react';

/**
 * useProctoringNotifications
 *
 * A standalone notification layer for the interview proctoring system.
 * Watches `warningCount` from useInterviewProctor and fires a browser
 * Notification API alert each time a new violation is recorded.
 *
 * Separation of concerns:
 *   - Detection  → useInterviewProctor (unchanged)
 *   - Modal UI   → InterviewProctoringOverlay (unchanged)
 *   - Notify     → this hook (new, additive only)
 *
 * Requirements:
 *   - HTTPS (or localhost) — Notifications API hard requirement
 *   - Graceful fallback when permission is denied / unsupported
 *   - Light throttle: one notification per violation, min 2 s apart
 *   - Clicking the notification focuses the interview tab
 *   - Cleans up open notifications on unmount
 */

interface UseProctoringNotificationsOptions {
  /** Current violation count from useInterviewProctor */
  warningCount: number;
  /** Max warnings ceiling (used to build "Warning X / Y" text) */
  maxWarnings: number;
  /** Whether the interview is actively being proctored */
  enabled?: boolean;
}

// Minimum ms between two successive notifications (anti-spam throttle)
const THROTTLE_MS = 2000;

export function useProctoringNotifications({
  warningCount,
  maxWarnings,
  enabled = true,
}: UseProctoringNotificationsOptions) {
  const permissionRef = useRef<NotificationPermission>('default');
  const lastFiredRef = useRef<number>(0);
  const prevCountRef = useRef<number>(0);
  const openNotifRef = useRef<Notification | null>(null);

  // ── Request permission once on mount (non-intrusive: no blocking prompt) ──
  useEffect(() => {
    if (!enabled) return;
    if (!('Notification' in window)) return;

    // Already decided — no need to ask again
    if (Notification.permission !== 'default') {
      permissionRef.current = Notification.permission;
      return;
    }

    // Ask quietly; we don't block the UI on the result
    Notification.requestPermission().then((perm) => {
      permissionRef.current = perm;
      console.log(`🔔 Notification permission: ${perm}`);
    });
  }, [enabled]);

  // ── Fire notification helper ───────────────────────────────────────────────
  const fireNotification = useCallback((count: number) => {
    if (!('Notification' in window)) return;
    if (permissionRef.current !== 'granted') return;

    const now = Date.now();
    if (now - lastFiredRef.current < THROTTLE_MS) return; // throttle
    lastFiredRef.current = now;

    // Close any previously open notification to avoid stacking
    if (openNotifRef.current) {
      openNotifRef.current.close();
      openNotifRef.current = null;
    }

    const remaining = maxWarnings - count;
    const body =
      remaining > 0
        ? `You have switched away from the interview. Warning ${count}/${maxWarnings} — ${remaining} violation${remaining !== 1 ? 's' : ''} remaining before termination.`
        : `Final violation reached. Your session is being terminated. Please return immediately.`;

    try {
      const notif = new Notification('⚠️ Security Violation Detected', {
        body,
        icon: '/favicon.ico',   // uses the app favicon; silently ignored if missing
        tag: 'proctoring-violation', // replaces previous notif with same tag
        requireInteraction: true,    // stays visible until user dismisses
      });

      // Clicking the notification brings the interview tab into focus
      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      openNotifRef.current = notif;
    } catch (err) {
      // Notification constructor can throw in some edge cases (e.g. service worker issues)
      console.warn('⚠️ Could not fire proctoring notification:', err);
    }
  }, [maxWarnings]);

  // ── Watch warningCount — fire on each new violation ───────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (warningCount > 0 && warningCount !== prevCountRef.current) {
      prevCountRef.current = warningCount;
      fireNotification(warningCount);
    }
  }, [enabled, warningCount, fireNotification]);

  // ── Cleanup open notification on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (openNotifRef.current) {
        openNotifRef.current.close();
        openNotifRef.current = null;
      }
    };
  }, []);

  // Expose permission state so callers can optionally surface a UI hint
  return {
    notificationPermission: permissionRef.current,
  };
}

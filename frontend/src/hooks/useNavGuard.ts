import { useEffect, useRef } from 'react';
import { useBeforeUnload } from 'react-router-dom';

/**
 * useNavGuard — prevents accidental navigation away from an active session.
 * - Blocks browser back/forward via popstate listener (works with BrowserRouter)
 * - Prompts on tab close / refresh via beforeunload
 *
 * Returns a `bypass` function: call it before any programmatic navigate() so
 * the guard does not intercept intentional back-button navigation.
 *
 * @param active  When true, the guard is active. Pass false to disable.
 * @param message Confirmation message shown to the user.
 */
export function useNavGuard(
  active: boolean,
  message = 'Are you sure you want to leave the active session?'
): { bypass: () => void } {
  const bypassRef = useRef(false);

  // Block browser refresh / tab close
  useBeforeUnload(
    (event) => {
      if (!active) return;
      event.preventDefault();
      event.returnValue = message;
    }
  );

  // Block browser back/forward via popstate
  useEffect(() => {
    if (!active) return;

    // Push a dummy state so we can intercept the popstate
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // If bypass was set (programmatic navigation), skip the guard
      if (bypassRef.current) {
        bypassRef.current = false;
        return;
      }
      if (!active) return;
      if (window.confirm(message)) {
        window.history.go(-1);
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [active, message]);

  // Fallback beforeunload for older browsers
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, message]);

  return {
    bypass: () => { bypassRef.current = true; },
  };
}

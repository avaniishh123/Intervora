// Keep-alive service: pings /health every 10 minutes to prevent Render cold starts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

const ping = async () => {
  try {
    await fetch(`${API_URL}/health`, { method: 'GET' });
  } catch {
    // Silently ignore — server may be temporarily unreachable
  }
};

export const startKeepAlive = () => {
  if (intervalId !== null) return; // already running
  ping(); // immediate ping on startup
  intervalId = setInterval(ping, PING_INTERVAL_MS);
};

export const stopKeepAlive = () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

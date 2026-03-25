import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { reportWebVitals, logPerformanceMetrics } from './utils/performance'
import './index.css'

// Create a client with optimized default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  // StrictMode disabled to prevent duplicate API calls during development
  // React.StrictMode causes components to mount twice, leading to duplicate session creation
  <QueryClientProvider client={queryClient}>
    <App />
    {/* DevTools completely disabled for clean production UI */}
  </QueryClientProvider>,
)

// Report web vitals in development
if (import.meta.env.DEV) {
  reportWebVitals((metric) => {
    console.log(`[Web Vitals] ${metric.name}:`, metric.value);
  });
  
  // Log performance metrics after page load
  window.addEventListener('load', () => {
    setTimeout(logPerformanceMetrics, 0);
  });
}

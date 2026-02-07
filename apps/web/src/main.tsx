import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, ToastProvider, ToastContainer } from './contexts'
import { App } from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 seconds before data is considered stale
      gcTime: 5 * 60_000,       // 5 minutes garbage collection (keep unused cache)
      refetchOnWindowFocus: false, // Don't silently refetch when user returns to tab
      refetchOnReconnect: true,   // Do refetch after network recovery
      retry: 1,                   // Retry failed requests once before erroring
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

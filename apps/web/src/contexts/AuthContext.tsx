/**
 * Authentication context for managing user auth state.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCurrentUser,
  useLogin,
  useLogout,
  useRegister,
  getAuthToken,
  clearAuthToken,
  queryKeys,
} from "../api";
import type { UserResponse, UserCreate, UserLogin } from "../api";

interface AuthContextValue {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: UserLogin) => Promise<void>;
  register: (data: UserCreate) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check if we have a token to determine if we should try to fetch user
  const hasToken = !!getAuthToken();

  const {
    data: user,
    isLoading: isLoadingUser,
    isError: userError,
  } = useCurrentUser({
    enabled: hasToken,
    retry: false,
  });

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();

  // Clear token if user fetch fails (token expired/invalid)
  useEffect(() => {
    if (userError && hasToken) {
      clearAuthToken();
      queryClient.removeQueries({ queryKey: queryKeys.me });
    }
  }, [userError, hasToken, queryClient]);

  const login = useCallback(
    async (data: UserLogin) => {
      setError(null);
      try {
        await loginMutation.mutateAsync(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Login failed";
        setError(message);
        throw err;
      }
    },
    [loginMutation]
  );

  const register = useCallback(
    async (data: UserCreate) => {
      setError(null);
      try {
        await registerMutation.mutateAsync(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Registration failed";
        setError(message);
        throw err;
      }
    },
    [registerMutation]
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Clear local state even if server logout fails
      clearAuthToken();
      queryClient.removeQueries({ queryKey: queryKeys.me });
    }
  }, [logoutMutation, queryClient]);

  const isLoading =
    isLoadingUser || loginMutation.isPending || registerMutation.isPending;

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

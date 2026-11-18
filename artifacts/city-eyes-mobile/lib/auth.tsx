import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { clearProtectedCache } from "./protected-cache";
import { getApiBaseUrl } from "@/lib/api-url";

WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = "auth_session_token";
const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://replit.com/oidc";
let webSessionToken: string | null = null;

let authSessionExpiredHandler: (() => void) | null = null;
export function registerAuthSessionExpiredHandler(handler: (() => void) | null) {
  authSessionExpiredHandler = handler;
}
export function triggerAuthSessionExpired() {
  authSessionExpiredHandler?.();
}

export async function getStoredAuthToken() {
  return Platform.OS === "web"
    ? webSessionToken
    : SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

async function setStoredAuthToken(token: string) {
  if (Platform.OS === "web") {
    webSessionToken = token;
    return;
  }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

async function clearStoredAuthToken() {
  if (Platform.OS === "web") {
    webSessionToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  error: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  error: "",
  login: async () => undefined,
  logout: async () => undefined,
  refreshUser: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return Platform.OS === "web" ? (
    <WebAuthProvider>{children}</WebAuthProvider>
  ) : (
    <NativeAuthProvider>{children}</NativeAuthProvider>
  );
}

function WebAuthProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState("");
  const login = useCallback(async () => {
    setError("O acesso seguro à conta está disponível no aplicativo móvel.");
  }, []);
  const logout = useCallback(async () => setError(""), []);
  const refreshUser = useCallback(async () => setError(""), []);

  return (
    <AuthContext.Provider
      value={{
        user: null,
        isLoading: false,
        error,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function NativeAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionRevision = useRef(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(() => Crypto.randomUUID());
  const handledCode = useRef("");
  const discovery = AuthSession.useAutoDiscovery(ISSUER_URL);
  const configuredScheme =
    (typeof Constants.expoConfig?.scheme === "string"
      ? Constants.expoConfig.scheme
      : undefined) ?? "city-eyes-mobile";
  const redirectUri = AuthSession.makeRedirectUri({ scheme: configuredScheme });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_REPL_ID ?? "",
      scopes: ["openid", "email", "profile", "offline_access"],
      redirectUri,
      prompt: AuthSession.Prompt.Login,
      extraParams: { nonce },
    },
    discovery,
  );

  const logout = useCallback(async () => {
    ++sessionRevision.current;
    setIsLoading(true);
    setUser(null);
    try {
      const token = await getStoredAuthToken();
      await clearStoredAuthToken();
      await clearProtectedCache(queryClient);
      const apiBase = getApiBaseUrl();
      if (token && apiBase) {
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
      }
    } catch {
      // The local token is still removed when the server cannot be reached or times out.
    } finally {
      await clearStoredAuthToken();
      setUser(null);
      setError("");
      setIsLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    registerAuthSessionExpiredHandler(() => {
      void logout();
    });
    return () => {
      registerAuthSessionExpiredHandler(null);
    };
  }, [logout]);

  const refreshUser = useCallback(async () => {
    const revision = ++sessionRevision.current;
    setIsLoading(true);
    try {
      const token = await getStoredAuthToken();
      if (!token) {
        await clearProtectedCache(queryClient);
        if (revision !== sessionRevision.current) return;
        setUser(null);
        setError("");
        return;
      }
      const apiBase = getApiBaseUrl();
      if (!apiBase) throw new Error("API unavailable");
      const response = await fetch(`${apiBase}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        if (revision !== sessionRevision.current) return;
        await clearStoredAuthToken();
        await clearProtectedCache(queryClient);
        setUser(null);
        setError("");
        return;
      }
      if (!response.ok) throw new Error("Account check failed");
      const body = (await response.json()) as { user: AuthUser | null };
      if (revision !== sessionRevision.current) return;
      await clearProtectedCache(queryClient);
      if (revision !== sessionRevision.current) return;
      if (body.user) {
        setUser(body.user);
        setError("");
      } else {
        await clearStoredAuthToken();
        setUser(null);
        setError("");
      }
    } catch {
      if (revision !== sessionRevision.current) return;
      setError("Não foi possível verificar sua conta. Confira a conexão e tente novamente.");
    } finally {
      if (revision === sessionRevision.current) setIsLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const authResponse =
      response?.type === "success" ? response : undefined;
    const code = authResponse?.params.code;
    if (
      !code ||
      !request?.codeVerifier ||
      !request.state ||
      handledCode.current === code
    ) {
      return;
    }
    handledCode.current = code;
    if (authResponse.params.state !== request.state) {
      setError("A confirmação do acesso expirou. Inicie o acesso novamente.");
      setIsLoading(false);
      return;
    }
    const revision = sessionRevision.current;
    setIsLoading(true);
    setError("");

    void (async () => {
      try {
        const apiBase = getApiBaseUrl();
        if (!apiBase) throw new Error("API unavailable");
        const exchangeResponse = await fetch(
          `${apiBase}/api/mobile-auth/token-exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              code_verifier: request.codeVerifier,
              redirect_uri: redirectUri,
              state: request.state,
              nonce,
            }),
          },
        );
        if (!exchangeResponse.ok) throw new Error("Login exchange failed");
        const body = (await exchangeResponse.json()) as { token?: string };
        if (!body.token) throw new Error("Session missing");
        if (revision !== sessionRevision.current) return;
        await setStoredAuthToken(body.token);
        if (revision !== sessionRevision.current) return;
        await refreshUser();
        if (revision !== sessionRevision.current) return;
        setNonce(Crypto.randomUUID());
      } catch {
        if (revision !== sessionRevision.current) return;
        setError("Não foi possível concluir o acesso. Tente entrar novamente.");
        setIsLoading(false);
      }
    })();
  }, [response, request, redirectUri, refreshUser, nonce]);

  const login = useCallback(async () => {
    setError("");
    if (!request?.codeVerifier) {
      setError("A página segura ainda está carregando. Tente novamente em instantes.");
      return;
    }
    try {
      const result = await promptAsync();
      if (result.type === "error" || result.type === "dismiss" || result.type === "cancel") {
        setError("O acesso não foi concluído. Você pode tentar novamente.");
        setNonce(Crypto.randomUUID());
      }
    } catch {
      setError("Não foi possível abrir o acesso seguro. Tente novamente.");
      setNonce(Crypto.randomUUID());
    }
  }, [promptAsync, request?.codeVerifier]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, error, login, logout, refreshUser }}
    >
      <React.Fragment key={user?.id ?? "anonymous"}>
        {children}
      </React.Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

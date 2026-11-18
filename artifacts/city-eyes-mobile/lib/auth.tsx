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
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = "auth_session_token";
const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://replit.com/oidc";
let webSessionToken: string | null = null;

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

function getApiBaseUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(() => Crypto.randomUUID());
  const handledCode = useRef("");
  const discovery = AuthSession.useAutoDiscovery(ISSUER_URL);
  const redirectUri = AuthSession.makeRedirectUri();
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

  const refreshUser = useCallback(async () => {
    try {
      const token = await getStoredAuthToken();
      if (!token) {
        setUser(null);
        setError("");
        return;
      }
      const apiBase = getApiBaseUrl();
      if (!apiBase) throw new Error("API unavailable");
      const response = await fetch(`${apiBase}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Account check failed");
      const body = (await response.json()) as { user: AuthUser | null };
      if (body.user) {
        setUser(body.user);
        setError("");
      } else {
        await clearStoredAuthToken();
        setUser(null);
        setError("");
      }
    } catch {
      setError("Não foi possível verificar sua conta. Confira a conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        await setStoredAuthToken(body.token);
        await refreshUser();
        setNonce(Crypto.randomUUID());
      } catch {
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

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getStoredAuthToken();
      const apiBase = getApiBaseUrl();
      if (token && apiBase) {
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // The local token is still removed when the server cannot be reached.
    } finally {
      await clearStoredAuthToken();
      setUser(null);
      setError("");
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, error, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

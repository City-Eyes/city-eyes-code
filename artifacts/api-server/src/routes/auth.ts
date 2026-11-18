import {
  ApiErrorSchema,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  GetCurrentAuthUserResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import * as oidc from "openid-client";
import {
  clearSession,
  createSession,
  deleteSession,
  getOidcConfig,
  getSessionId,
  ISSUER_URL,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";

const router: IRouter = Router();
const OIDC_COOKIE_TTL = 10 * 60 * 1000;

function sendApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  return response
    .status(status)
    .json(ApiErrorSchema.parse({ code, message }));
}

function getOrigin(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || typeof host !== "string") {
    throw new Error("Request host is unavailable.");
  }
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string): void {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeErrorMetadata(error: unknown): Record<string, unknown> {
  if (!isRecord(error)) return { errorName: typeof error };
  const cause = isRecord(error.cause) ? error.cause : null;
  const status = error.status ?? error.statusCode ?? cause?.status;
  return {
    errorName: error instanceof Error ? error.name : "Error",
    ...(typeof status === "string" || typeof status === "number"
      ? { errorStatus: status }
      : {}),
  };
}

function claimString(
  claims: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

async function upsertUser(claims: Record<string, unknown>) {
  const id = claimString(claims, "sub");
  if (!id) throw new Error("The identity provider returned no subject.");
  const userData = {
    id,
    email: claimString(claims, "email"),
    firstName: claimString(claims, "first_name", "given_name"),
    lastName: claimString(claims, "last_name", "family_name"),
    profileImageUrl: claimString(claims, "profile_image_url", "picture"),
  };
  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();
  return user;
}

function createSessionData(
  user: Awaited<ReturnType<typeof upsertUser>>,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
): SessionData {
  const now = Math.floor(Date.now() / 1000);
  const claims = tokens.claims();
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    access_token: tokens.access_token,
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    expires_at: tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : typeof claims?.exp === "number"
        ? claims.exp
        : undefined,
  };
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const authorizationUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", getSafeReturnTo(req.query.returnTo));
  res.redirect(authorizationUrl.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const codeVerifier = req.cookies?.code_verifier;
  const expectedState = req.cookies?.state;
  const nonce = req.cookies?.nonce;
  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const currentUrl = new URL(
    `${callbackUrl}?${new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`,
    ).searchParams}`,
  );
  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch (error) {
    req.log.warn(safeErrorMetadata(error), "OIDC callback validation failed");
    res.redirect("/api/login");
    return;
  }

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }
  const user = await upsertUser(claims as Record<string, unknown>);
  const sid = await createSession(createSessionData(user, tokens));
  for (const cookie of ["code_verifier", "nonce", "state", "return_to"]) {
    res.clearCookie(cookie, { path: "/" });
  }
  setSessionCookie(res, sid);
  res.redirect(getSafeReturnTo(req.cookies?.return_to));
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);
  const returnTo = getSafeReturnTo(req.query.returnTo);
  await clearSession(res, getSessionId(req));
  const replitId = process.env.REPL_ID;
  if (!replitId) throw new Error("Replit OIDC client is not configured.");
  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: replitId,
    post_logout_redirect_uri: new URL(returnTo, `${origin}/`).href,
  });
  res.redirect(endSessionUrl.href);
});

router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    return sendApiError(
      res,
      400,
      "INVALID_AUTH_REQUEST",
      "Não foi possível iniciar a sessão.",
    );
  }
  const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(redirect_uri);
  } catch {
    return sendApiError(
      res,
      400,
      "INVALID_REDIRECT_URI",
      "O retorno do aplicativo não é válido.",
    );
  }
  if (!isAllowedMobileRedirectProtocol(callbackUrl.protocol)) {
    return sendApiError(
      res,
      400,
      "INVALID_REDIRECT_URI",
      "O retorno do aplicativo não é válido.",
    );
  }
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("state", state);
  callbackUrl.searchParams.set("iss", ISSUER_URL);

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: code_verifier,
      expectedNonce: nonce,
      expectedState: state,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims || typeof claims.sub !== "string") {
      return sendApiError(
        res,
        401,
        "AUTHORIZATION_CODE_INVALID",
        "Não foi possível confirmar sua conta.",
      );
    }
    const user = await upsertUser(claims as Record<string, unknown>);
    const token = await createSession(createSessionData(user, tokens));
    return res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token }));
  } catch (error) {
    req.log.warn(safeErrorMetadata(error), "Mobile authorization exchange failed");
    return sendApiError(
      res,
      401,
      "AUTHORIZATION_CODE_INVALID",
      "Não foi possível confirmar sua conta.",
    );
  }
});

export function isAllowedMobileRedirectProtocol(protocol: string) {
  return ["http:", "https:", "exp:", "city-eyes-mobile:"].includes(protocol);
}

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid && sid.length <= 128) await deleteSession(sid);
  return res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;

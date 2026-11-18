import type { NextFunction, Request, Response } from "express";
import * as oidc from "openid-client";
import {
  clearSession,
  getOidcConfig,
  getSession,
  getSessionId,
  updateSession,
  type AuthenticatedUser,
  type SessionData,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User;
    }

    interface AuthedRequest extends Request {
      user: User;
    }
  }
}

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now < session.expires_at - 30) return session;
  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(config, session.refresh_token);
    const expiresIn = tokens.expiresIn();
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    if (expiresIn) session.expires_at = now + expiresIn;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid || sid.length > 128) {
    next();
    return;
  }

  try {
    const session = await getSession(sid);
    if (!session?.user?.id) {
      await clearSession(res, sid);
      next();
      return;
    }
    const refreshed = await refreshIfExpired(sid, session);
    if (!refreshed) {
      await clearSession(res, sid);
      next();
      return;
    }
    req.user = refreshed.user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({
      code: "AUTHENTICATION_REQUIRED",
      message: "Entre na sua conta para continuar.",
    });
    return;
  }
  next();
}

import type { Request } from "express";

export function buildPublicPhotoUrl(req: Request, objectPath: string): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || typeof host !== "string") {
    throw new Error("Request host is unavailable.");
  }
  const cleanPath = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath.replace(/^\/+/, "");
  const path = cleanPath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return new URL(`/api/storage/objects/${path}`, `${protocol}://${host}`).href;
}

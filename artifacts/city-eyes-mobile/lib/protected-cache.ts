import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const protectedKey = (userId: string | undefined, key: QueryKey) =>
  ["protected", userId ?? "anonymous", ...key] as const;

export function isPublicKey(queryKey: QueryKey): boolean {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  const first = queryKey[0];
  if (first === "public") return true;
  if (first === "/api/cities") return true;
  if (first === "/api/health" || first === "/api/readiness") return true;
  return false;
}

export async function clearProtectedCache(client: QueryClient) {
  const filters = {
    predicate: (query: { queryKey: QueryKey }) => !isPublicKey(query.queryKey),
  };
  await client.cancelQueries(filters);
  client.removeQueries(filters);
  client.getMutationCache().clear();
}

export function isAuthorizationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error.status === 401 || error.status === 403)
  );
}

export function draftKeyFor(userId: string, cityId: string) {
  return `city-eyes-report-draft-v2:${encodeURIComponent(userId)}:${encodeURIComponent(cityId)}`;
}

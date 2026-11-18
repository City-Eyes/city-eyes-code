import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const protectedKey = (userId: string | undefined, key: QueryKey) =>
  ["protected", userId ?? "anonymous", ...key] as const;

export async function clearProtectedCache(client: QueryClient) {
  const filters = { predicate: (query: { queryKey: QueryKey }) => query.queryKey[0] === "protected" };
  await client.cancelQueries(filters);
  client.removeQueries(filters);
  client.getMutationCache().clear();
}

export function isAuthorizationError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "status" in error && (error.status === 401 || error.status === 403);
}

export function draftKeyFor(userId: string, cityId: string) {
  return `city-eyes-report-draft-v2:${encodeURIComponent(userId)}:${encodeURIComponent(cityId)}`;
}

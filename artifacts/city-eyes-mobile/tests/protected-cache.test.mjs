import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  clearProtectedCache,
  draftKeyFor,
  isAuthorizationError,
  isPublicKey,
  protectedKey,
} from "../lib/protected-cache.ts";

test("protected query cache is isolated by user and removed on logout", async () => {
  const client = new QueryClient();
  const reportKey = ["reports", "city-1"];
  client.setQueryData(protectedKey("operator-a", reportKey), ["internal note"]);
  client.setQueryData(["public", "reports", "city-1"], ["public report"]);
  client.setQueryData(["/api/cities"], [{ id: "curitiba", name: "Curitiba" }]);

  assert.notDeepEqual(protectedKey("operator-a", reportKey), protectedKey("operator-b", reportKey));
  await clearProtectedCache(client);
  assert.equal(client.getQueryData(protectedKey("operator-a", reportKey)), undefined);
  assert.equal(client.getQueryData(["public", "reports", "city-1"])[0], "public report");
  assert.equal(client.getQueryData(["/api/cities"])[0].id, "curitiba");
});

test("user switch from A to B clears protected and non-prefixed operational queries", async () => {
  const client = new QueryClient();

  // User A sets both protectedKey and unprefixed queries (e.g. operator endpoints)
  client.setQueryData(protectedKey("operator-a", ["queue"]), ["report-1", "report-2"]);
  client.setQueryData(["/api/operator/cities"], [{ id: "curitiba" }]);
  client.setQueryData(["operator-internal-memo"], { confidential: true });
  client.setQueryData(["/api/cities"], [{ id: "curitiba" }]);
  client.setQueryData(["public", "items"], ["item-1"]);

  // Switch user: clearProtectedCache
  await clearProtectedCache(client);

  // User A's data and all non-public data MUST be gone
  assert.equal(client.getQueryData(protectedKey("operator-a", ["queue"])), undefined);
  assert.equal(client.getQueryData(["/api/operator/cities"]), undefined);
  assert.equal(client.getQueryData(["operator-internal-memo"]), undefined);

  // Public data must remain
  assert.deepEqual(client.getQueryData(["/api/cities"]), [{ id: "curitiba" }]);
  assert.deepEqual(client.getQueryData(["public", "items"]), ["item-1"]);

  // User B populates their cache
  client.setQueryData(protectedKey("operator-b", ["queue"]), ["report-3"]);
  assert.deepEqual(client.getQueryData(protectedKey("operator-b", ["queue"])), ["report-3"]);
  assert.equal(client.getQueryData(protectedKey("operator-a", ["queue"])), undefined);
});

test("401 error clears protected and non-public cache", async () => {
  const client = new QueryClient();

  client.setQueryData(protectedKey("operator-a", ["queue"]), ["sensitive-data"]);
  client.setQueryData(["/api/operator/cities"], [{ id: "curitiba" }]);
  client.setQueryData(["public", "info"], "public");

  const err401 = { status: 401 };
  assert.equal(isAuthorizationError(err401), true);

  // On 401: clearProtectedCache is called
  await clearProtectedCache(client);

  assert.equal(client.getQueryData(protectedKey("operator-a", ["queue"])), undefined);
  assert.equal(client.getQueryData(["/api/operator/cities"]), undefined);
  assert.equal(client.getQueryData(["public", "info"]), "public");
});

test("draft storage is scoped to the user and authorization errors fail closed", () => {
  assert.notEqual(draftKeyFor("user-a", "curitiba"), draftKeyFor("user-b", "curitiba"));
  assert.equal(isAuthorizationError({ status: 403 }), true);
  assert.equal(isAuthorizationError({ status: 401 }), true);
  assert.equal(isAuthorizationError({ status: 500 }), false);
  assert.equal(isAuthorizationError(new Error("network error")), false);
  assert.equal(isPublicKey(["public", "foo"]), true);
  assert.equal(isPublicKey(["/api/cities"]), true);
  assert.equal(isPublicKey(["/api/operator/cities"]), false);
});

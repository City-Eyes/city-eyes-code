import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  clearProtectedCache,
  draftKeyFor,
  isAuthorizationError,
  protectedKey,
} from "../lib/protected-cache.ts";

test("protected query cache is isolated by user and removed on logout", async () => {
  const client = new QueryClient();
  const reportKey = ["reports", "city-1"];
  client.setQueryData(protectedKey("operator-a", reportKey), ["internal note"]);
  client.setQueryData(["public", "reports", "city-1"], ["public report"]);

  assert.notDeepEqual(protectedKey("operator-a", reportKey), protectedKey("operator-b", reportKey));
  await clearProtectedCache(client);
  assert.equal(client.getQueryData(protectedKey("operator-a", reportKey)), undefined);
  assert.equal(client.getQueryData(["public", "reports", "city-1"])[0], "public report");
});

test("draft storage is scoped to the user and authorization errors fail closed", () => {
  assert.notEqual(draftKeyFor("user-a", "curitiba"), draftKeyFor("user-b", "curitiba"));
  assert.equal(isAuthorizationError({ status: 403 }), true);
  assert.equal(isAuthorizationError({ status: 401 }), true);
  assert.equal(isAuthorizationError({ status: 500 }), false);
});

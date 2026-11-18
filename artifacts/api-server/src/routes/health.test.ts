import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { createHealthRouter } from "./health";

let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl = "";

async function startServer(checkDatabase: () => Promise<unknown>) {
  const app = express();
  app.use("/api", createHealthRouter(checkDatabase));

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("The test API server did not expose a TCP address."));
        return;
      }

      baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}/api`;
      resolve();
    });
    server.once("error", reject);
  });
}

async function stopServer() {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

before(async () => {
  await startServer(async () => undefined);
});

after(stopServer);

test("liveness stays healthy without exposing dependency details", async () => {
  const response = await fetch(`${baseUrl}/healthz`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("readiness reports a healthy database dependency", async () => {
  const response = await fetch(`${baseUrl}/readyz`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    dependencies: { database: "ok" },
  });
});

test("readiness returns 503 and hides database errors", async () => {
  await stopServer();
  await startServer(async () => {
    throw new Error("private connection details");
  });

  const response = await fetch(`${baseUrl}/readyz`);
  const body = await response.text();

  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(body), {
    status: "error",
    dependencies: { database: "unavailable" },
  });
  assert.equal(body.includes("private connection details"), false);
});

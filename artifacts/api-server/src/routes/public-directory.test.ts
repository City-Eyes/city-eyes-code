import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app";
import { pool } from "@workspace/db";

let server: ReturnType<typeof app.listen>;
let baseUrl = "";

before(async () => {
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
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await pool.end();
});

test("lists the four configured pilot cities", async () => {
  const response = await fetch(`${baseUrl}/cities`);
  const data = (await response.json()) as Array<{
    id: string;
    reportCount: number;
  }>;

  assert.equal(response.status, 200);
  assert.deepEqual(
    data.map((city) => city.id),
    ["curitiba", "londrina", "maringa", "ponta-grossa"],
  );
  assert.ok(data.every((city) => city.reportCount >= 0));
});

test("paginates reports only for the selected city", async () => {
  const response = await fetch(
    `${baseUrl}/cities/curitiba/reports?page=1&limit=1`,
  );
  const data = (await response.json()) as {
    items: Array<{ cityId: string }>;
    total: number;
    hasNextPage: boolean;
  };

  assert.equal(response.status, 200);
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0]?.cityId, "curitiba");
  assert.ok(data.total >= 1);
  assert.equal(data.hasNextPage, data.total > 1);
});

test("does not return another city's report through the detail route", async () => {
  const response = await fetch(
    `${baseUrl}/cities/londrina/reports/demo-curitiba-01`,
  );
  const data = (await response.json()) as { code: string };

  assert.equal(response.status, 404);
  assert.equal(data.code, "REPORT_NOT_FOUND");
});

test("returns an empty page without treating it as an error", async () => {
  const response = await fetch(
    `${baseUrl}/cities/curitiba/reports?page=100000&limit=50`,
  );
  const data = (await response.json()) as {
    items: unknown[];
    total: number;
    hasNextPage: boolean;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(data.items, []);
  assert.ok(data.total >= 1);
  assert.equal(data.hasNextPage, false);
});

test("rejects invalid pagination with the shared API error shape", async () => {
  const response = await fetch(
    `${baseUrl}/cities/curitiba/reports?page=0&limit=50`,
  );
  const data = (await response.json()) as {
    code: string;
    message: string;
  };

  assert.equal(response.status, 400);
  assert.equal(data.code, "INVALID_PAGINATION");
  assert.ok(data.message.length > 0);
});

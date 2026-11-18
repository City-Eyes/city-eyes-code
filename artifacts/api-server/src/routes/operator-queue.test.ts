import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import {
  cityMemberships,
  db,
  pool,
  reportEvents,
  reports,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createApp } from "../app";

const userId = `operator-test-${randomUUID()}`;
const sessionId = randomUUID().replaceAll("-", "").repeat(2);
const reportId = `operator-report-${randomUUID()}`;
const olderReportId = `operator-report-${randomUUID()}`;
const createdAt = new Date();
const app = createApp();
const baseUrlRef = { value: "" };
let server: ReturnType<typeof app.listen>;
const authorization = `Bearer ${sessionId}`;

before(async () => {
  await db.insert(usersTable).values({ id: userId });
  await db.insert(sessionsTable).values({
    sid: sessionId,
    sess: {
      user: {
        id: userId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      },
      access_token: "isolated-test-session",
      expires_at: Math.floor(Date.now() / 1000) + 3_600,
    },
    expire: new Date(Date.now() + 3_600_000),
  });
  await db.insert(cityMemberships).values({
    userId,
    cityId: "curitiba",
    role: "operator",
  });
  await db.insert(reports).values({
    id: reportId,
    cityId: "curitiba",
    reporterId: userId,
    title: "Teste de fila municipal",
    description: "Relato sintético para teste de autorização.",
    category: "accessibility",
    locationLabel: "Local de teste",
    latitude: -25.43,
    longitude: -49.27,
    status: "open",
    createdAt,
    isDemo: false,
  });
  await db.insert(reports).values({
    id: olderReportId,
    cityId: "curitiba",
    reporterId: userId,
    title: "Relato mais antigo para teste",
    description: "Relato sintético para validar a ordenação.",
    category: "accessibility",
    locationLabel: "Local de teste",
    latitude: -25.43,
    longitude: -49.27,
    status: "open",
    createdAt: new Date(createdAt.getTime() - 60_000),
    isDemo: false,
  });

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test API did not bind to a TCP address."));
        return;
      }
      baseUrlRef.value = `http://127.0.0.1:${(address as AddressInfo).port}/api`;
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
  await db.delete(reportEvents).where(eq(reportEvents.reportId, reportId));
  await db.delete(reportEvents).where(eq(reportEvents.reportId, olderReportId));
  await db.delete(reports).where(eq(reports.id, reportId));
  await db.delete(reports).where(eq(reports.id, olderReportId));
  await db
    .delete(cityMemberships)
    .where(eq(cityMemberships.userId, userId));
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sessionId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
});

test("municipal queue restricts access and keeps internal notes private", async () => {
  const assignedCities = await fetch(`${baseUrlRef.value}/operator/cities`, {
    headers: { Authorization: authorization },
  });
  const cityList = (await assignedCities.json()) as Array<{ id: string }>;
  assert.equal(assignedCities.status, 200);
  assert.deepEqual(cityList.map((city) => city.id), ["curitiba"]);

  const queueResponse = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports?page=1&limit=50&status=open&sort=newest`,
    { headers: { Authorization: authorization } },
  );
  const queue = (await queueResponse.json()) as {
    items: Array<{ id: string; status: string }>;
    total: number;
  };
  assert.equal(queueResponse.status, 200);
  assert.ok(queue.items.some((report) => report.id === reportId));
  assert.ok(queue.total >= 1);
  assert.ok(
    queue.items.findIndex((report) => report.id === reportId) <
      queue.items.findIndex((report) => report.id === olderReportId),
  );

  const oldestFirstResponse = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports?page=1&limit=50&status=open&sort=oldest`,
    { headers: { Authorization: authorization } },
  );
  const oldestFirst = (await oldestFirstResponse.json()) as {
    items: Array<{ id: string }>;
  };
  assert.equal(oldestFirstResponse.status, 200);
  assert.ok(
    oldestFirst.items.findIndex((report) => report.id === olderReportId) <
      oldestFirst.items.findIndex((report) => report.id === reportId),
  );

  const crossCityQueue = await fetch(
    `${baseUrlRef.value}/operator/cities/londrina/reports`,
    { headers: { Authorization: authorization } },
  );
  const queueError = (await crossCityQueue.json()) as { code: string };
  assert.equal(crossCityQueue.status, 403);
  assert.equal(queueError.code, "CITY_ACCESS_DENIED");

  const crossCityUpdate = await fetch(
    `${baseUrlRef.value}/operator/cities/londrina/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "resolved" }),
    },
  );
  assert.equal(crossCityUpdate.status, 403);

  const update = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "in_progress",
        publicNote: "A equipe está avaliando o local.",
        internalNote: "Confirmar responsável pela vistoria.",
      }),
    },
  );
  const updated = (await update.json()) as {
    status: string;
    events: Array<{ internalNote: string | null }>;
  };
  assert.equal(update.status, 200);
  assert.equal(updated.status, "in_progress");
  assert.equal(
    updated.events.at(-1)?.internalNote,
    "Confirmar responsável pela vistoria.",
  );

  const publicDetail = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}`,
  );
  const publicReport = (await publicDetail.json()) as {
    status: string;
    events: Array<Record<string, unknown>>;
  };
  assert.equal(publicDetail.status, 200);
  assert.equal(publicReport.status, "in_progress");
  assert.equal(
    publicReport.events.at(-1)?.publicNote,
    "A equipe está avaliando o local.",
  );
  assert.equal("internalNote" in (publicReport.events.at(-1) ?? {}), false);

  const unassignedUserId = `unassigned-test-${randomUUID()}`;
  const unassignedSessionId = randomUUID().replaceAll("-", "").repeat(2);
  await db.insert(usersTable).values({ id: unassignedUserId });
  await db.insert(sessionsTable).values({
    sid: unassignedSessionId,
    sess: {
      user: {
        id: unassignedUserId,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
      },
      access_token: "isolated-test-session",
    },
    expire: new Date(Date.now() + 3_600_000),
  });
  try {
    const noCities = await fetch(`${baseUrlRef.value}/operator/cities`, {
      headers: { Authorization: `Bearer ${unassignedSessionId}` },
    });
    assert.equal(noCities.status, 200);
    assert.deepEqual(await noCities.json(), []);

    const deniedQueue = await fetch(
      `${baseUrlRef.value}/operator/cities/curitiba/reports`,
      { headers: { Authorization: `Bearer ${unassignedSessionId}` } },
    );
    assert.equal(deniedQueue.status, 403);
  } finally {
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.sid, unassignedSessionId));
    await db.delete(usersTable).where(eq(usersTable.id, unassignedUserId));
  }
});

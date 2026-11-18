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

  // 1. Rejeição de atualização sem notas e sem mudança de status
  const emptyUpdate = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "open" }),
    },
  );
  assert.equal(emptyUpdate.status, 400);
  const emptyErr = (await emptyUpdate.json()) as { code: string };
  assert.equal(emptyErr.code, "EMPTY_REPORT_UPDATE");

  // 2. Adicionar apenas nota interna sem alterar status (status: open)
  const noteOnlyUpdate = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "open",
        internalNote: "Nota preliminar de triagem.",
      }),
    },
  );
  assert.equal(noteOnlyUpdate.status, 200);
  const noteOnlyResult = (await noteOnlyUpdate.json()) as {
    status: string;
    events: Array<{ internalNote: string | null }>;
  };
  assert.equal(noteOnlyResult.status, "open");
  assert.equal(noteOnlyResult.events.at(-1)?.internalNote, "Nota preliminar de triagem.");

  // 3. Rejeição de transição inválida (open -> resolved direto)
  const invalidJump = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "resolved" }),
    },
  );
  assert.equal(invalidJump.status, 400);
  const jumpErr = (await invalidJump.json()) as { code: string };
  assert.equal(jumpErr.code, "INVALID_STATUS_TRANSITION");

  // 4. Transição válida para in_progress
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

  // 5. Transição válida de in_progress para resolved com evidência fotográfica
  const resolveUpdate = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "resolved",
        publicNote: "Problema resolvido com sucesso.",
        evidenceImageObjectPath: "published/evidence-resolved.jpg",
      }),
    },
  );
  assert.equal(resolveUpdate.status, 200);
  const resolvedResult = (await resolveUpdate.json()) as {
    status: string;
    events: Array<{ evidenceImageUrl: string | null }>;
  };
  assert.equal(resolvedResult.status, "resolved");
  assert.ok(
    resolvedResult.events.at(-1)?.evidenceImageUrl?.includes("published/evidence-resolved.jpg"),
  );

  // 6. Bloqueio de retrocesso pós-resolução (resolved -> open)
  const regressionUpdate = await fetch(
    `${baseUrlRef.value}/operator/cities/curitiba/reports/${reportId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "open" }),
    },
  );
  assert.equal(regressionUpdate.status, 400);
  const regErr = (await regressionUpdate.json()) as { code: string };
  assert.equal(regErr.code, "INVALID_STATUS_TRANSITION");

  // 7. Confirmação de que rota pública nunca expõe internalNote e projeta foto de evidência
  const publicDetail = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}`,
  );
  const publicReport = (await publicDetail.json()) as {
    status: string;
    events: Array<Record<string, unknown>>;
  };
  assert.equal(publicDetail.status, 200);
  assert.equal(publicReport.status, "resolved");
  assert.equal(
    publicReport.events.at(-1)?.publicNote,
    "Problema resolvido com sucesso.",
  );
  assert.equal("internalNote" in (publicReport.events.at(-1) ?? {}), false);
  assert.ok(publicReport.events.every((e) => !("internalNote" in e)));
  assert.ok(
    String(publicReport.events.at(-1)?.evidenceImageUrl).includes("published/evidence-resolved.jpg"),
  );

  // 8. Confirmações cidadãs (B-12): apoio e confirmação de resolução
  // 8.1 Rejeição de confirmação anônima
  const anonConfirm = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}/confirmations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "support" }),
    },
  );
  assert.equal(anonConfirm.status, 401);

  // 8.2 Cidadão 1 registra apoio
  const citizen1Id = `citizen1-test-${randomUUID()}`;
  const citizen1SessionId = randomUUID().replaceAll("-", "").repeat(2);
  await db.insert(usersTable).values({ id: citizen1Id });
  await db.insert(sessionsTable).values({
    sid: citizen1SessionId,
    sess: {
      user: {
        id: citizen1Id,
        email: "citizen1@example.test",
        firstName: "Cidadao",
        lastName: "Um",
        profileImageUrl: null,
      },
      access_token: "isolated-citizen-session-1",
      expires_at: Math.floor(Date.now() / 1000) + 3_600,
    },
    expire: new Date(Date.now() + 3_600_000),
  });

  const citizen1Auth = `Bearer ${citizen1SessionId}`;
  const support1 = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}/confirmations`,
    {
      method: "POST",
      headers: {
        Authorization: citizen1Auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "support" }),
    },
  );
  assert.equal(support1.status, 200);
  const support1Body = (await support1.json()) as { count: number; userHasConfirmed: boolean };
  assert.equal(support1Body.count, 1);
  assert.equal(support1Body.userHasConfirmed, true);

  // 8.3 Cidadão 1 tenta registrar apoio novamente -> 409 ALREADY_CONFIRMED
  const duplicateSupport = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}/confirmations`,
    {
      method: "POST",
      headers: {
        Authorization: citizen1Auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "support" }),
    },
  );
  assert.equal(duplicateSupport.status, 409);
  const dupErr = (await duplicateSupport.json()) as { code: string };
  assert.equal(dupErr.code, "ALREADY_CONFIRMED");

  // 8.4 Cidadão 2 registra apoio -> contagem sobe para 2
  const citizen2Id = `citizen2-test-${randomUUID()}`;
  const citizen2SessionId = randomUUID().replaceAll("-", "").repeat(2);
  await db.insert(usersTable).values({ id: citizen2Id });
  await db.insert(sessionsTable).values({
    sid: citizen2SessionId,
    sess: {
      user: {
        id: citizen2Id,
        email: "citizen2@example.test",
        firstName: "Cidadao",
        lastName: "Dois",
        profileImageUrl: null,
      },
      access_token: "isolated-citizen-session-2",
      expires_at: Math.floor(Date.now() / 1000) + 3_600,
    },
    expire: new Date(Date.now() + 3_600_000),
  });
  const citizen2Auth = `Bearer ${citizen2SessionId}`;

  const support2 = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}/confirmations`,
    {
      method: "POST",
      headers: {
        Authorization: citizen2Auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "support" }),
    },
  );
  assert.equal(support2.status, 200);
  const support2Body = (await support2.json()) as { count: number };
  assert.equal(support2Body.count, 2);

  // 8.5 Cidadão 1 confirma resolução
  const resConfirm = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}/confirmations`,
    {
      method: "POST",
      headers: {
        Authorization: citizen1Auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "resolution" }),
    },
  );
  assert.equal(resConfirm.status, 200);
  const resConfirmBody = (await resConfirm.json()) as { count: number };
  assert.equal(resConfirmBody.count, 1);

  // 8.6 Consulta pública com cidadão 1 autenticado reflete confirmações individuais
  const authDetail = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}`,
    { headers: { Authorization: citizen1Auth } },
  );
  assert.equal(authDetail.status, 200);
  const authReport = (await authDetail.json()) as {
    supportsCount: number;
    resolutionConfirmationsCount: number;
    userHasSupported: boolean;
    userHasConfirmedResolution: boolean;
  };
  assert.equal(authReport.supportsCount, 2);
  assert.equal(authReport.resolutionConfirmationsCount, 1);
  assert.equal(authReport.userHasSupported, true);
  assert.equal(authReport.userHasConfirmedResolution, true);

  // 8.7 Consulta pública anônima oculta flags individuais mantendo totais
  const anonDetail = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${reportId}`,
  );
  assert.equal(anonDetail.status, 200);
  const anonReport = (await anonDetail.json()) as {
    supportsCount: number;
    resolutionConfirmationsCount: number;
    userHasSupported: boolean;
    userHasConfirmedResolution: boolean;
  };
  assert.equal(anonReport.supportsCount, 2);
  assert.equal(anonReport.resolutionConfirmationsCount, 1);
  assert.equal(anonReport.userHasSupported, false);
  assert.equal(anonReport.userHasConfirmedResolution, false);

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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import {
  db,
  mediaUploads,
  pool,
  reportEvents,
  reports,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type { ImageStorage, VerifiedImage } from "../lib/objectStorage";
import {
  InvalidUploadedImageError,
  ObjectNotFoundError,
  isSupportedImageSignature,
} from "../lib/objectStorage";
import { sweepExpiredPhotos } from "../lib/photo-retention";
import { createApp } from "../app";
import { isAllowedMobileRedirectProtocol } from "./auth";

class FakeImageStorage implements ImageStorage {
  readonly paths = new Set<string>();
  readonly publicPaths = new Set<string>();
  readonly invalidPaths = new Set<string>();
  verifyCalls = 0;

  async createUploadUrl() {
    const objectPath = `/objects/uploads/${randomUUID()}`;
    this.paths.add(objectPath);
    return {
      objectPath,
      uploadURL: `https://storage.example.test/signed/${randomUUID()}`,
    };
  }

  async verifyImage(
    objectPath: string,
    contentType: string,
    size: number,
  ): Promise<VerifiedImage> {
    this.verifyCalls += 1;
    if (!this.paths.has(objectPath)) throw new ObjectNotFoundError();
    if (this.invalidPaths.has(objectPath)) {
      throw new InvalidUploadedImageError();
    }
    const finalPath = `/objects/published/${randomUUID()}`;
    this.paths.add(finalPath);
    return {
      objectPath: finalPath,
      contentType: contentType as VerifiedImage["contentType"],
      size,
    };
  }

  async setVisibility(
    objectPath: string,
    _ownerId: string,
    visibility: "private" | "public",
  ) {
    if (!this.paths.has(objectPath)) throw new ObjectNotFoundError();
    if (visibility === "public") this.publicPaths.add(objectPath);
    else this.publicPaths.delete(objectPath);
  }

  async streamPublicImage(objectPath: string) {
    if (!this.publicPaths.has(objectPath)) throw new ObjectNotFoundError();
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    return {
      stream: Readable.from(bytes),
      contentType: "image/jpeg",
      size: bytes.length,
    };
  }

  async deleteObject(objectPath: string) {
    this.paths.delete(objectPath);
    this.publicPaths.delete(objectPath);
  }
}

const storage = new FakeImageStorage();
const app = createApp(storage);
const userId = `urban-test-${randomUUID()}`;
const sessionId = randomUUID().replaceAll("-", "").repeat(2);
const reportIds: string[] = [];
const baseUrlRef = { value: "" };
let server: ReturnType<typeof app.listen>;
let authorization = "";

before(async () => {
  await db.insert(usersTable).values({
    id: userId,
    email: "urban-test@example.test",
    firstName: "Test",
    lastName: "Operator",
  });
  await db.insert(sessionsTable).values({
    sid: sessionId,
    sess: {
      user: {
        id: userId,
        email: "urban-test@example.test",
        firstName: "Test",
        lastName: "Operator",
        profileImageUrl: null,
      },
      access_token: "isolated-test-session",
      expires_at: Math.floor(Date.now() / 1000) + 3_600,
    },
    expire: new Date(Date.now() + 3_600_000),
  });
  authorization = `Bearer ${sessionId}`;

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
  const objectPaths = [...storage.paths];
  if (reportIds.length > 0) {
    await db
      .delete(reportEvents)
      .where(inArray(reportEvents.reportId, reportIds));
    await db.delete(reports).where(inArray(reports.id, reportIds));
  }
  if (objectPaths.length > 0) {
    await db
      .delete(mediaUploads)
      .where(inArray(mediaUploads.objectPath, objectPaths));
  }
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sessionId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
});

async function requestUploadUrl(
  size = 12,
  contentType = "image/jpeg",
): Promise<{
  response: Response;
  objectPath: string;
  uploadURL?: string;
  expiresAt?: string;
}> {
  const response = await fetch(
    `${baseUrlRef.value}/storage/uploads/request-url`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ size, contentType }),
    },
  );
  const body = (await response.json()) as {
    objectPath?: string;
    uploadURL?: string;
    expiresAt?: string;
  };
  return {
    response,
    objectPath: body.objectPath ?? "",
    uploadURL: body.uploadURL,
    expiresAt: body.expiresAt,
  };
}

function reportBody(
  imageObjectPath: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    title: "Calçada danificada",
    description: "Trecho irregular próximo ao ponto de ônibus.",
    category: "accessibility",
    locationLabel: "Rua de teste, Centro",
    latitude: -25.43,
    longitude: -49.27,
    captureSource: "gallery",
    imageObjectPath,
    consentToPublicDisplay: true,
    ...overrides,
  };
}

test("anonymous sessions cannot upload or submit reports", async () => {
  const currentUser = await fetch(`${baseUrlRef.value}/auth/user`);
  const currentUserBody = (await currentUser.json()) as { user: unknown };
  assert.equal(currentUser.status, 200);
  assert.equal(currentUserBody.user, null);

  const upload = await fetch(
    `${baseUrlRef.value}/storage/uploads/request-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size: 12, contentType: "image/jpeg" }),
    },
  );
  assert.equal(upload.status, 401);

  const submission = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportBody("/objects/not-authorized")),
    },
  );
  const error = (await submission.json()) as { code: string };
  assert.equal(submission.status, 401);
  assert.equal(error.code, "AUTHENTICATION_REQUIRED");
});

test("authenticated browser cookies and mobile bearer tokens resolve the same session", async () => {
  const bearer = await fetch(`${baseUrlRef.value}/auth/user`, {
    headers: { Authorization: authorization },
  });
  const cookie = await fetch(`${baseUrlRef.value}/auth/user`, {
    headers: { Cookie: `sid=${sessionId}` },
  });
  const bearerBody = (await bearer.json()) as { user: { id: string } | null };
  const cookieBody = (await cookie.json()) as { user: { id: string } | null };
  assert.equal(bearer.status, 200);
  assert.equal(cookie.status, 200);
  assert.equal(bearerBody.user?.id, userId);
  assert.equal(cookieBody.user?.id, userId);
});

test("authenticated upload URL requests enforce file type and size", async () => {
  const unsupported = await requestUploadUrl(12, "image/gif");
  assert.equal(unsupported.response.status, 400);
  assert.equal(unsupported.objectPath, "");

  const oversized = await requestUploadUrl(10 * 1024 * 1024 + 1);
  assert.equal(oversized.response.status, 400);

  const valid = await requestUploadUrl();
  assert.equal(valid.response.status, 200);
  assert.match(valid.uploadURL ?? "", /^https:\/\/storage\.example\.test\//);
  assert.ok(Date.parse(valid.expiresAt ?? "") > Date.now());

  const notPublic = await fetch(
    `${baseUrlRef.value}/storage/objects/${valid.objectPath.slice("/objects/".length)}`,
  );
  assert.equal(notPublic.status, 404);

  const invalidImage = await requestUploadUrl();
  storage.invalidPaths.add(invalidImage.objectPath);
  const invalidSubmission = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reportBody(invalidImage.objectPath)),
    },
  );
  const invalidImageBody = (await invalidSubmission.json()) as { code: string };
  assert.equal(invalidSubmission.status, 400);
  assert.equal(invalidImageBody.code, "INVALID_PHOTO");
  storage.invalidPaths.delete(invalidImage.objectPath);
});

test("server rejects coordinates outside the selected city's estimated bounds", async () => {
  const upload = await requestUploadUrl();
  assert.equal(upload.response.status, 200);
  const beforeVerification = storage.verifyCalls;
  const response = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        reportBody(upload.objectPath, {
          latitude: 0,
          longitude: 0,
        }),
      ),
    },
  );
  const error = (await response.json()) as { code: string };
  assert.equal(response.status, 400);
  assert.equal(error.code, "LOCATION_OUTSIDE_CITY");
  assert.equal(storage.verifyCalls, beforeVerification);
});

test("session owns the report and public output omits operator-only notes", async () => {
  const upload = await requestUploadUrl();
  assert.equal(upload.response.status, 200);
  const submission = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        reportBody(upload.objectPath, {
          reporterId: "forged-user-id",
          cityId: "londrina",
        }),
      ),
    },
  );
  const report = (await submission.json()) as {
    id: string;
    cityId: string;
    photoUrl: string | null;
    status: string;
    events: Array<{ id: string; publicNote: string | null }>;
  };
  assert.equal(submission.status, 201);
  assert.equal(report.cityId, "curitiba");
  assert.equal(report.status, "open");
  assert.ok(report.photoUrl);
  assert.equal(report.events.length, 1);
  reportIds.push(report.id);

  const stored = await db
    .select()
    .from(reports)
    .where(eq(reports.id, report.id))
    .limit(1);
  assert.equal(stored[0]?.reporterId, userId);
  assert.equal(stored[0]?.isDemo, false);
  assert.ok(stored[0]?.publicConsentAt);

  const publicDetail = await fetch(
    `${baseUrlRef.value}/cities/curitiba/reports/${report.id}`,
  );
  const publicReport = (await publicDetail.json()) as {
    status: string;
    events: Array<Record<string, unknown>>;
  };
  assert.equal(publicDetail.status, 200);
  assert.equal(publicReport.status, "open");
  assert.equal(publicReport.events.at(-1)?.publicNote, null);
  assert.equal("internalNote" in (publicReport.events.at(-1) ?? {}), false);

  const photo = await fetch(report.photoUrl!);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get("content-type"), "image/jpeg");
  assert.equal(storage.publicPaths.has(upload.objectPath), false);
  const stagingPhoto = await fetch(
    `${baseUrlRef.value}/storage/objects/${upload.objectPath.slice("/objects/".length)}`,
  );
  assert.equal(stagingPhoto.status, 404);

  await db
    .update(mediaUploads)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(mediaUploads.reportId, report.id));
  assert.equal(await sweepExpiredPhotos(storage), 2);
  const expiredReport = await db
    .select({ imageObjectPath: reports.imageObjectPath })
    .from(reports)
    .where(eq(reports.id, report.id))
    .limit(1);
  assert.equal(expiredReport[0]?.imageObjectPath, null);
  const expiredPhoto = await fetch(report.photoUrl!);
  assert.equal(expiredPhoto.status, 404);
});

test("image signature validation rejects mismatched metadata", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Buffer.from("RIFFxxxxWEBP", "ascii");
  assert.equal(isSupportedImageSignature(jpeg, "image/jpeg"), true);
  assert.equal(isSupportedImageSignature(png, "image/png"), true);
  assert.equal(isSupportedImageSignature(webp, "image/webp"), true);
  assert.equal(isSupportedImageSignature(jpeg, "image/png"), false);
  assert.equal(isSupportedImageSignature(Buffer.from("GIF89a"), "image/gif"), false);
});

test("native authorization callback accepts the configured Expo scheme only", () => {
  const mobileConfig = JSON.parse(
    readFileSync(new URL("../../../city-eyes-mobile/app.json", import.meta.url), "utf8"),
  ) as { expo: { scheme: string } };
  assert.equal(isAllowedMobileRedirectProtocol(`${mobileConfig.expo.scheme}:`), true);
  assert.equal(isAllowedMobileRedirectProtocol("exp:"), true);
  assert.equal(isAllowedMobileRedirectProtocol("cityeyes:"), false);
  assert.equal(isAllowedMobileRedirectProtocol("javascript:"), false);
});

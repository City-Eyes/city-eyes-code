import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import type { Storage } from "@google-cloud/storage";
import {
  InvalidUploadedImageError,
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

function createMockGcs() {
  const store = new Map<
    string,
    {
      generations: Map<number, Buffer>;
      latestGeneration: number;
      metadata: Record<string, unknown>;
    }
  >();

  function getEntry(name: string) {
    let entry = store.get(name);
    if (!entry) {
      entry = { generations: new Map(), latestGeneration: 0, metadata: {} };
      store.set(name, entry);
    }
    return entry;
  }

  const mockBucket = {
    file(storagePath: string, options?: { generation?: number }) {
      const entry = getEntry(storagePath);
      const reqGen = options?.generation;

      const fileObj: any = {
        name: storagePath,
        bucket: mockBucket,
        async exists() {
          return [entry.latestGeneration > 0];
        },
        async getMetadata() {
          if (entry.latestGeneration === 0) {
            throw new Error("File not found");
          }
          return [
            {
              ...entry.metadata,
              generation: entry.latestGeneration,
            },
          ];
        },
        async download() {
          const gen = reqGen ?? entry.latestGeneration;
          const bytes = entry.generations.get(gen);
          if (!bytes) {
            throw new Error(`Generation ${gen} not found`);
          }
          return [bytes];
        },
        async save(bytes: Buffer, opts?: any) {
          if (
            opts?.preconditionOpts?.ifGenerationMatch === 0 &&
            entry.latestGeneration > 0
          ) {
            const err: any = new Error(
              "Precondition Failed: ifGenerationMatch: 0 failed",
            );
            err.code = 412;
            throw err;
          }
          const nextGen = entry.latestGeneration + 1;
          entry.latestGeneration = nextGen;
          entry.generations.set(nextGen, bytes);
          entry.metadata = {
            ...opts?.metadata,
            size: bytes.length,
            contentType: opts?.metadata?.contentType,
          };
        },
        async setMetadata(meta: any) {
          entry.metadata = {
            ...entry.metadata,
            metadata: {
              ...(entry.metadata.metadata as any),
              ...meta?.metadata,
            },
          };
        },
        createReadStream() {
          const bytes = entry.generations.get(entry.latestGeneration);
          return Readable.from(bytes ?? Buffer.alloc(0));
        },
        async delete(opts?: any) {
          store.delete(storagePath);
        },
      };
      return fileObj;
    },
  };

  const client = {
    bucket(_bucketName: string) {
      return mockBucket;
    },
  } as unknown as Storage;

  return { client, store, mockBucket };
}

test("staging overwritten after verify does not alter published object", async () => {
  const { client, mockBucket } = createMockGcs();
  const service = new ObjectStorageService(client);

  const privateDir = (process.env.PRIVATE_OBJECT_DIR || "test-bucket/photos").replace(/^\/+|\/+$/g, "");
  const relDir = privateDir.slice(privateDir.indexOf("/") + 1);

  const initialJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x01, 0x02]);
  const stagingPath = `${relDir}/uploads/photo-1`;
  await mockBucket.file(stagingPath).save(initialJpeg, {
    metadata: { contentType: "image/jpeg" },
  });

  const verified = await service.verifyImage(
    "/objects/uploads/photo-1",
    "image/jpeg",
    initialJpeg.length,
  );
  assert.ok(verified.objectPath.startsWith("/objects/published/"));

  // Staging is overwritten afterwards
  const forgedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xee, 0x99, 0x88]);
  await mockBucket.file(stagingPath).save(forgedJpeg, {
    metadata: { contentType: "image/jpeg" },
  });

  const publishedStoragePath = `${relDir}/${verified.objectPath.slice("/objects/".length)}`;
  const [publishedBytes] = await mockBucket.file(publishedStoragePath).download();
  assert.deepEqual(publishedBytes, initialJpeg);
  assert.notDeepEqual(publishedBytes, forgedJpeg);
});

test("destination collision on ifGenerationMatch:0 is rejected", async () => {
  const { client, mockBucket } = createMockGcs();
  const testFile = mockBucket.file("test-bucket/published/collision-test");
  await testFile.save(Buffer.from("first-write"), {});

  await assert.rejects(
    async () => {
      await testFile.save(Buffer.from("second-write"), {
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    },
    (err: any) => err.code === 412,
  );
});

test("streamPublicImage returns 404 / ObjectNotFoundError on /objects/uploads/", async () => {
  const { client } = createMockGcs();
  const service = new ObjectStorageService(client);

  await assert.rejects(
    async () => {
      await service.streamPublicImage("/objects/uploads/x");
    },
    (err: any) => err instanceof ObjectNotFoundError,
  );

  await assert.rejects(
    async () => {
      await service.streamPublicImage("/objects/staging/x");
    },
    (err: any) => err instanceof ObjectNotFoundError,
  );
});

test("rejection of size and signature mismatches", async () => {
  const { client, mockBucket } = createMockGcs();
  const service = new ObjectStorageService(client);

  const privateDir = (process.env.PRIVATE_OBJECT_DIR || "test-bucket/photos").replace(/^\/+|\/+$/g, "");
  const relDir = privateDir.slice(privateDir.indexOf("/") + 1);

  // Mismatched signature
  const invalidSig = Buffer.from("GIF89a-not-a-jpeg");
  await mockBucket.file(`${relDir}/uploads/invalid-sig`).save(invalidSig, {
    metadata: { contentType: "image/jpeg" },
  });
  await assert.rejects(
    async () => {
      await service.verifyImage(
        "/objects/uploads/invalid-sig",
        "image/jpeg",
        invalidSig.length,
      );
    },
    (err: any) => err instanceof InvalidUploadedImageError,
  );

  // Mismatched size
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  await mockBucket.file(`${relDir}/uploads/valid-jpeg`).save(validJpeg, {
    metadata: { contentType: "image/jpeg" },
  });
  await assert.rejects(
    async () => {
      await service.verifyImage(
        "/objects/uploads/valid-jpeg",
        "image/jpeg",
        validJpeg.length + 10,
      );
    },
    (err: any) => err instanceof InvalidUploadedImageError,
  );

  // Size over limit
  await assert.rejects(
    async () => {
      await service.verifyImage(
        "/objects/uploads/valid-jpeg",
        "image/jpeg",
        11 * 1024 * 1024,
      );
    },
    (err: any) => err instanceof InvalidUploadedImageError,
  );
});

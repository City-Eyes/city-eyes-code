import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { File, Storage } from "@google-cloud/storage";
import {
  canAccessObject,
  getObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
  type ObjectAclPolicy,
} from "./objectAcl";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class InvalidUploadedImageError extends Error {
  constructor() {
    super("Uploaded photo validation failed.");
    this.name = "InvalidUploadedImageError";
  }
}

export interface VerifiedImage {
  objectPath: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  size: number;
}

export interface ImageStorage {
  createUploadUrl(): Promise<{ uploadURL: string; objectPath: string }>;
  verifyImage(
    objectPath: string,
    expectedContentType: string,
    expectedSize: number,
  ): Promise<VerifiedImage>;
  setVisibility(
    objectPath: string,
    ownerId: string,
    visibility: "private" | "public",
  ): Promise<void>;
  streamPublicImage(
    objectPath: string,
  ): Promise<{ stream: Readable; contentType: string; size: number }>;
  deleteObject(objectPath: string): Promise<void>;
}

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectStorageService implements ImageStorage {
  constructor(private readonly client: Storage = objectStorageClient) {}
  private getPrivateObjectDir(): string {
    const path = process.env.PRIVATE_OBJECT_DIR?.trim();
    if (!path) throw new Error("Private photo storage is not configured.");
    return path.replace(/^\/+|\/+$/g, "");
  }

  async createUploadUrl(): Promise<{ uploadURL: string; objectPath: string }> {
    const objectName = `uploads/${randomUUID()}`;
    const fullPath = `/${this.getPrivateObjectDir()}/${objectName}`;
    const { bucketName, storagePath } = parseObjectPath(fullPath);
    const uploadURL = await signObjectURL({
      bucketName,
      objectName: storagePath,
      method: "PUT",
      ttlSec: 900,
    });
    return {
      uploadURL,
      objectPath: this.normalizeObjectEntityPath(uploadURL),
    };
  }

  async verifyImage(
    objectPath: string,
    expectedContentType: string,
    expectedSize: number,
  ): Promise<VerifiedImage> {
    const file = await this.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size);
    const actualContentType = metadata.contentType;
    if (
      !Number.isSafeInteger(actualSize) ||
      actualSize < 1 ||
      actualSize > MAX_IMAGE_BYTES ||
      actualSize !== expectedSize ||
      actualContentType !== expectedContentType
    ) {
      throw new InvalidUploadedImageError();
    }

    // Pin the read to the exact generation whose metadata was validated.
    if (!metadata.generation) throw new InvalidUploadedImageError();
    const pinned = file.bucket.file(file.name, { generation: metadata.generation });
    const [bytes] = await pinned.download();
    if (bytes.length !== actualSize || !isSupportedImageSignature(bytes, expectedContentType)) {
      throw new InvalidUploadedImageError();
    }
    // Never publish the client-writable staging key. Only these validated bytes
    // are written to a fresh, create-only server-owned destination.
    const finalPath = `/objects/published/${randomUUID()}`;
    const { bucketName, storagePath } = parseObjectPath(
      `/${this.getPrivateObjectDir()}/${finalPath.slice("/objects/".length)}`,
    );
    await this.client.bucket(bucketName).file(storagePath).save(bytes, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: expectedContentType },
    });
    return {
      objectPath: finalPath,
      contentType: expectedContentType as VerifiedImage["contentType"],
      size: actualSize,
    };
  }

  async setVisibility(
    objectPath: string,
    ownerId: string,
    visibility: "private" | "public",
  ): Promise<void> {
    const file = await this.getObjectEntityFile(objectPath);
    await setObjectAclPolicy(file, { owner: ownerId, visibility });
  }

  async streamPublicImage(objectPath: string) {
    if (!objectPath.startsWith("/objects/published/")) throw new ObjectNotFoundError();
    const file = await this.getObjectEntityFile(objectPath);
    const policy = await getObjectAclPolicy(file);
    if (!policy || !(await canAccessObject(file, ObjectPermission.READ))) {
      throw new ObjectNotFoundError();
    }
    const [metadata] = await file.getMetadata();
    return {
      stream: file.createReadStream(),
      contentType: String(metadata.contentType || "application/octet-stream"),
      size: Number(metadata.size || 0),
    };
  }

  async deleteObject(objectPath: string): Promise<void> {
    const file = await this.getObjectEntityFile(objectPath);
    await file.delete({ ignoreNotFound: true });
  }

  private async getObjectEntityFile(objectPath: string): Promise<File> {
    if (
      !objectPath.startsWith("/objects/") ||
      objectPath.includes("..") ||
      objectPath.includes("\\")
    ) {
      throw new ObjectNotFoundError();
    }
    const entity = objectPath.slice("/objects/".length);
    if (!entity || entity.startsWith("/")) throw new ObjectNotFoundError();
    const fullPath = `/${this.getPrivateObjectDir()}/${entity}`;
    const { bucketName, storagePath } = parseObjectPath(fullPath);
    const file = this.client.bucket(bucketName).file(storagePath);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  private normalizeObjectEntityPath(rawPath: string): string {
    const signedUrl = new URL(rawPath);
    const rawPathname = decodeURIComponent(signedUrl.pathname);
    const objectDir = `/${this.getPrivateObjectDir()}/`;
    if (!rawPathname.startsWith(objectDir)) {
      throw new Error("Storage returned an unexpected object path.");
    }
    const entity = rawPathname.slice(objectDir.length);
    if (!entity || entity.includes("..") || entity.includes("\\")) {
      throw new Error("Storage returned an invalid object path.");
    }
    return `/objects/${entity}`;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  storagePath: string;
} {
  const normalized = path.replace(/^\/+/, "");
  const separator = normalized.indexOf("/");
  if (separator <= 0 || separator === normalized.length - 1) {
    throw new Error("Private object storage path is invalid.");
  }
  return {
    bucketName: normalized.slice(0, separator),
    storagePath: normalized.slice(separator + 1),
  };
}

export function isSupportedImageSignature(
  bytes: Buffer,
  contentType: string,
): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "PUT";
  ttlSec: number;
}): Promise<string> {
  const response = await fetch(
    `${SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error("Could not create a photo upload URL.");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("signed_url" in body) ||
    typeof body.signed_url !== "string"
  ) {
    throw new Error("Storage returned an invalid upload URL.");
  }
  return body.signed_url;
}

import { and, eq, lte } from "drizzle-orm";
import { db, mediaUploads, reports } from "@workspace/db";
import {
  ObjectNotFoundError,
  ObjectStorageService,
  type ImageStorage,
} from "./objectStorage";
import { logger } from "./logger";

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const BATCH_SIZE = 100;

export function startPhotoRetentionCleanup(
  storage: ObjectStorageService = new ObjectStorageService(),
): void {
  let running = false;

  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      await sweepExpiredPhotos(storage);
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Photo retention sweep failed",
      );
    } finally {
      running = false;
    }
  };

  void sweep();
  const interval = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  interval.unref();
}

export async function sweepExpiredPhotos(
  storage: Pick<ImageStorage, "deleteObject">,
): Promise<number> {
  const expired = await db
    .select({ objectPath: mediaUploads.objectPath })
    .from(mediaUploads)
    .where(lte(mediaUploads.expiresAt, new Date()))
    .limit(BATCH_SIZE);
  let removed = 0;

  for (const item of expired) {
    try {
      await storage.deleteObject(item.objectPath);
    } catch (error) {
      if (!(error instanceof ObjectNotFoundError)) {
        logger.warn(
          {
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          "Could not delete an expired report photo",
        );
        continue;
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(reports)
        .set({ imageObjectPath: null })
        .where(eq(reports.imageObjectPath, item.objectPath));
      await tx
        .delete(mediaUploads)
        .where(
          and(
            eq(mediaUploads.objectPath, item.objectPath),
            lte(mediaUploads.expiresAt, new Date()),
          ),
        );
    });
    removed += 1;
  }
  if (removed > 0) {
    logger.info({ removed }, "Expired report photos were removed");
  }
  return removed;
}

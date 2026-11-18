import { index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { reports } from "./reports";
import { usersTable } from "./auth";

export const mediaUploads = pgTable(
  "city_eyes_media_uploads",
  {
    objectPath: text("object_path").primaryKey(),
    ownerId: varchar("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    expectedSize: integer("expected_size").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    uploadUrlExpiresAt: timestamp("upload_url_expires_at", {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reportId: text("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("city_eyes_media_uploads_owner_idx").on(table.ownerId),
    index("city_eyes_media_uploads_expiry_idx").on(table.expiresAt),
  ],
);

export type MediaUpload = typeof mediaUploads.$inferSelect;

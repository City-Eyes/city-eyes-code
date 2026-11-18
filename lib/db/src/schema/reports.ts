import { index, pgEnum, pgTable, text, timestamp, varchar, doublePrecision, boolean, unique } from "drizzle-orm/pg-core";
import { cities } from "./cities";
import { usersTable } from "./auth";

export const reportStatusEnum = pgEnum("city_eyes_report_status", [
  "open",
  "in_review",
  "in_progress",
  "resolved",
]);

export const captureSourceEnum = pgEnum("city_eyes_capture_source", [
  "camera",
  "gallery",
]);

export const reportConfirmationTypeEnum = pgEnum("city_eyes_confirmation_type", [
  "support",
  "resolution",
]);

export const reports = pgTable(
  "city_eyes_reports",
  {
    id: text("id").primaryKey(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    reporterId: varchar("reporter_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    locationLabel: text("location_label").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    imageObjectPath: text("image_object_path"),
    captureSource: captureSourceEnum("capture_source"),
    publicConsentAt: timestamp("public_consent_at", { withTimezone: true }),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (table) => [
    index("city_eyes_reports_city_created_idx").on(
      table.cityId,
      table.createdAt,
      table.id,
    ),
    index("city_eyes_reports_city_status_created_idx").on(
      table.cityId,
      table.status,
      table.createdAt,
    ),
    index("city_eyes_reports_reporter_idx").on(table.reporterId),
  ],
);

export const reportEvents = pgTable(
  "city_eyes_report_events",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    statusBefore: reportStatusEnum("status_before"),
    statusAfter: reportStatusEnum("status_after").notNull(),
    publicNote: text("public_note"),
    internalNote: text("internal_note"),
    evidenceImageObjectPath: text("evidence_image_object_path"),
    actorId: varchar("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("city_eyes_report_events_report_created_idx").on(
      table.reportId,
      table.createdAt,
      table.id,
    ),
    index("city_eyes_report_events_city_created_idx").on(
      table.cityId,
      table.createdAt,
    ),
  ],
);

export const reportConfirmations = pgTable(
  "city_eyes_report_confirmations",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: reportConfirmationTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("city_eyes_report_confirmations_user_report_type_unique").on(
      table.userId,
      table.reportId,
      table.type,
    ),
    index("city_eyes_report_confirmations_report_type_idx").on(
      table.reportId,
      table.type,
    ),
  ],
);

export type ReportRecord = typeof reports.$inferSelect;
export type ReportEventRecord = typeof reportEvents.$inferSelect;
export type ReportConfirmationRecord = typeof reportConfirmations.$inferSelect;

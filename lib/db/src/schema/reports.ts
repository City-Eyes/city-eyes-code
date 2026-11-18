import { index, text, timestamp, boolean, pgTable } from "drizzle-orm/pg-core";
import { cities } from "./cities";

export const reports = pgTable(
  "city_eyes_reports",
  {
    id: text("id").primaryKey(),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    locationLabel: text("location_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (table) => [
    index("city_eyes_reports_city_created_idx").on(
      table.cityId,
      table.createdAt,
      table.id,
    ),
  ],
);

export type ReportRecord = typeof reports.$inferSelect;

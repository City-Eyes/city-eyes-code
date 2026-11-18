import { doublePrecision, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const cities = pgTable("city_eyes_cities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  bboxMinLatitude: doublePrecision("bbox_min_latitude").notNull(),
  bboxMinLongitude: doublePrecision("bbox_min_longitude").notNull(),
  bboxMaxLatitude: doublePrecision("bbox_max_latitude").notNull(),
  bboxMaxLongitude: doublePrecision("bbox_max_longitude").notNull(),
  boundarySource: text("boundary_source").notNull(),
  boundarySourceUrl: text("boundary_source_url").notNull(),
  boundaryRetrievedAt: timestamp("boundary_retrieved_at", {
    withTimezone: true,
  }).notNull(),
});

export type CityRecord = typeof cities.$inferSelect;

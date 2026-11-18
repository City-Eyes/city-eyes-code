import { text, pgTable } from "drizzle-orm/pg-core";

export const cities = pgTable("city_eyes_cities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
});

export type CityRecord = typeof cities.$inferSelect;

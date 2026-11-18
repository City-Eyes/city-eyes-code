import { index, pgEnum, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { cities } from "./cities";
import { usersTable } from "./auth";

export const cityMembershipRoleEnum = pgEnum("city_eyes_membership_role", [
  "operator",
  "city_admin",
]);

export const cityMemberships = pgTable(
  "city_eyes_city_memberships",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    cityId: text("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "cascade" }),
    role: cityMembershipRoleEnum("role").notNull().default("operator"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cityId] }),
    index("city_eyes_city_memberships_city_role_idx").on(
      table.cityId,
      table.role,
    ),
  ],
);

export type CityMembership = typeof cityMemberships.$inferSelect;

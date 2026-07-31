import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const qrCodes = sqliteTable("qr_codes", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  editToken: text("edit_token").notNull(),
  scans: integer("scans").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

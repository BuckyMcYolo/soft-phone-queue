import { integer, pgTable, varchar, pgEnum } from "drizzle-orm/pg-core"

export const callStatusEnum = pgEnum("call_status", [
  "queued",
  "in_progress",
  "completed",
  "failed",
])

export const callQueue = pgTable("call_queue", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  createdAt: integer("created_at")
    .notNull()
    .$default(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$onUpdate(() => Date.now()),
  callSid: varchar("call_sid").notNull().unique(),
  callerNumber: varchar("caller_number").notNull(),
  callerName: varchar("caller_name").notNull(),
  status: callStatusEnum().notNull().default("queued"),
})

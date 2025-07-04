import {
  integer,
  pgTable,
  varchar,
  pgEnum,
  timestamp,
} from "drizzle-orm/pg-core"

export const callStatusEnum = pgEnum("call_status", [
  "queued",
  "in_progress",
  "completed",
  "failed",
  "on_hold",
])

export const callQueue = pgTable("call_queue", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  createdAt: timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdateFn(() => new Date()),
  callSid: varchar("call_sid").notNull().unique(),
  callerNumber: varchar("caller_number").notNull(),
  callerName: varchar("caller_name").notNull(),
  status: callStatusEnum().notNull().default("queued"),
})

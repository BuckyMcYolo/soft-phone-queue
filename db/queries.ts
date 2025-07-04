import { db } from "."
import { callQueue } from "./schema"
import { eq } from "drizzle-orm"

// Add caller to queue (when call comes in)
export const addToQueue = async (caller: {
  From: string
  CallSid: string
  CallStatus: string
}) => {
  const queue = await db
    .insert(callQueue)
    .values({
      callerNumber: caller.From,
      callerName: `Unknown Name`,
      callSid: caller.CallSid,
      status: "queued",
    })
    .returning()
  if (!queue || queue.length === 0) {
    throw new Error("Failed to add caller to queue")
  }
  return queue[0]
}

// Get current queue
export const getQueue = async () => {
  const queue = await db.query.callQueue.findMany({
    orderBy: (table, { asc }) => asc(table.createdAt),
  })
  if (!queue) {
    throw new Error("Failed to retrieve queue")
  }
  return queue
}
// Remove from queue (when answered/declined)
export const removeFromQueue = async (callSid: string) => {
  const result = await db
    .delete(callQueue)
    .where(eq(callQueue.callSid, callSid))

  if (result.rowCount.toFixed().length === 0) {
    throw new Error("Failed to remove caller from queue")
  }
}

// Update call status
export const updateCallStatus = async (
  callSid: string,
  status: "queued" | "in_progress" | "completed" | "failed"
) => {
  const result = await db
    .update(callQueue)
    .set({ status })
    .where(eq(callQueue.callSid, callSid))
    .returning()

  if (!result || result.length === 0) {
    throw new Error("Failed to update call status")
  }
  return result[0]
}

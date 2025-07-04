//this is for answering calls, putting callers on hold, and ending calls

// This handles all call actions from frontend
import { getQueue, removeFromQueue, updateCallStatus } from "@/db/queries"
import { publishCallUpdate, publishQueueUpdate } from "@/lib/ably"
import { Twilio } from "twilio"
import { NextRequest, NextResponse } from "next/server"

const client = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(req: NextRequest) {
  try {
    const {
      action,
      callSid,
      callData,
    }: {
      action: "answer" | "decline" | "hold" | "end"
      callSid: string
      callData?: any // Optional data for answering calls
    } = await req.json()

    switch (action) {
      case "answer":
        await answerCall(callSid, callData)
        break
      case "decline":
        await declineCall(callSid)
        break
      case "hold":
        await holdCall(callSid)
        break
      case "end":
        await endCall(callSid)
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ message: "Action completed" })
  } catch (error) {
    console.error("Error in call control:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

async function answerCall(callSid: string, callData: any) {
  // 1. Remove from queue in DB
  await removeFromQueue(callSid)

  // 3. Get updated queue
  const queue = await getQueue()

  // 4. Publish updates
  await publishQueueUpdate(queue)
  await publishCallUpdate(callData)
}

async function declineCall(callSid: string) {
  // 1. Hangup the call
  await client.calls(callSid).update({ status: "completed" })

  // 2. Remove from queue
  await removeFromQueue(callSid)

  // 4. Update frontend
  const queue = await getQueue()
  await publishQueueUpdate(queue)
}

async function holdCall(callSid: string) {
  // 1. Update status in DB
  await updateCallStatus(callSid, "in_progress")

  // 3. Publish update
  await publishCallUpdate({ callSid, status: "on-hold" })
}

async function endCall(callSid: string) {
  // 1. Hangup the call
  await client.calls(callSid).update({ status: "completed" })

  // 2. Remove from queue
  await removeFromQueue(callSid)

  // 4. Clear active call
  await publishCallUpdate(undefined)
}

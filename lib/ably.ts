// This handles all real-time updates
import Ably from "ably"

const ably = new Ably.Realtime({
  key: process.env.NEXT_PUBLIC_ABLY_API_KEY,
})

interface Queue {
  status: "queued" | "in_progress" | "completed" | "failed"
  id: number
  callSid: string
  callerNumber: string
  callerName: string
}

const channel = ably.channels.get(process.env.NEXT_PUBLIC_ABLY_CHANNEL!)

// Publish queue updates to frontend
export const publishQueueUpdate = async (queue: Queue[]) => {
  await channel.publish("queue-updated", { queue })
}

// Publish incoming call notification
export const publishIncomingCall = async (caller: Queue) => {
  await channel.publish("incoming-call", { caller })
}

// Publish active call updates
export const publishCallUpdate = async (callData: any) => {
  await channel.publish("call-updated", { callData })
}

export default ably

// twilio sends a webhook here when a call is received
// Handler saves caller to database
// Handler tells Ably "new caller joined"
// Ably instantly notifies your web interface
// Your UI shows incoming call popup
// puts caller in queue
import { addToQueue, getQueue } from "@/db/queries"
import { publishIncomingCall, publishQueueUpdate } from "@/lib/ably"
import VoiceResponse from "twilio/lib/twiml/VoiceResponse"

export async function POST(request: Request) {
  const twiml = new VoiceResponse()
  try {
    const formData = await request.formData()

    console.log(formData)

    // Extract Twilio parameters from form data
    const To = formData.get("To") as string
    const From = formData.get("From") as string
    const CallSid = formData.get("CallSid") as string
    const CallStatus = formData.get("CallStatus") as string

    console.log("Incoming call request:", {
      To,
      From,
      CallSid,
      CallStatus,
    })

    if (To != process.env.TWILIO_NUMBER) {
      return new Response(JSON.stringify({ error: "Invalid number" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    // 1. Add to database
    // const queueItem = await addToQueue(caller)
    const queueItem = await addToQueue({
      From,
      CallSid,
      CallStatus,
    })

    // 2. Get updated queue
    // const queue = await getQueue()
    const queue = await getQueue()

    if (!queue) {
      return new Response(
        JSON.stringify({ error: "Failed to retrieve queue" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }

    // 3. Publish real-time updates
    await publishQueueUpdate(queue)
    await publishIncomingCall(queueItem)

    twiml.say("Please hold while we connect you to an agent.")

    const dial = twiml.dial()

    dial.conference(
      {
        waitUrl: "https://twimlets.com/holdmusic?Bucket=com.twilio.music.rock",
        statusCallback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/call-status`,
        statusCallbackEvent: ["start", "end", "join", "leave"],
      },
      `hold-room`
    )

    // 5. Return TwiML response
    return new Response(twiml.toString(), {
      headers: {
        "Content-Type": "application/xml",
      },
    })
  } catch (error) {
    console.error("Error handling incoming call:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

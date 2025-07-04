// gets incoming status updates from Twilio and updates the queue
import { removeFromQueue } from "@/db/queries"
import { publishQueueUpdate } from "@/lib/ably"
// import VoiceResponse from "twilio/lib/twiml/VoiceResponse"

export async function POST(request: Request) {
  //   const twiml = new VoiceResponse()
  try {
    const formData = await request.formData()

    console.log(formData)

    // Extract Twilio parameters from form data
    // const ConferenceSid = formData.get("ConferenceSid") as string
    const StatusCallBackEvent = formData.get("StatusCallbackEvent") as string
    const CallSid = formData.get("CallSid") as string
    // const ReasonParticipantLeft = formData.get(
    //   "ReasonParticipantLeft"
    // ) as string

    if (StatusCallBackEvent === "participant-leave") {
      //delete the call from the queue
      await removeFromQueue(CallSid)

      // Send real-time updates to the frontend
      await publishQueueUpdate([])
      return new Response(
        JSON.stringify({ message: "Call removed from queue" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }
    // Handle other status callback events if needed
    console.log("Unhandled StatusCallbackEvent:", StatusCallBackEvent)
    return new Response(
      JSON.stringify({ message: "StatusCallbackEvent not handled" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
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

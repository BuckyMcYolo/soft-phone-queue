// gets incoming status updates from Twilio and updates the queue
import { removeFromQueue } from "@/db/queries"
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
    }
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

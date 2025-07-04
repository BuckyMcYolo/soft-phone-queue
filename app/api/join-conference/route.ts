import VoiceResponse from "twilio/lib/twiml/VoiceResponse"

export async function POST(req: Request) {
  const formData = await req.formData()

  const callSid = formData.get("callSid") as string
  const twiml = new VoiceResponse()

  const dial = twiml.dial()

  console.log("CONFERENCE SID:", `hold-room-${callSid}`)

  dial.conference(
    {
      startConferenceOnEnter: true, // Start conference when agent joins
      endConferenceOnExit: true, // End when agent leaves
      muted: false,
    },
    `hold-room-${callSid}`
  )
  return new Response(twiml.toString(), {
    headers: {
      "Content-Type": "text/xml",
    },
  })
}

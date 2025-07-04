// /api/twiml/wait-for-agent
// This endpoint keeps the caller waiting for an agent to pick up

export async function POST(req: Request) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play loop="0">http://com.twilio.music.ambient.s3.amazonaws.com/Long_Northern_Lights.wav</Play>
    <Pause length="10"/>
    <Redirect>/api/twiml/wait-for-agent</Redirect>
</Response>`

  return new Response(twiml, {
    headers: {
      "Content-Type": "text/xml",
    },
  })
}

export async function GET(req: Request) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play loop="0">http://com.twilio.music.ambient.s3.amazonaws.com/Long_Northern_Lights.wav</Play>
    <Pause length="10"/>
    <Redirect>/api/twiml/wait-for-agent</Redirect>
</Response>`

  return new Response(twiml, {
    headers: {
      "Content-Type": "text/xml",
    },
  })
}

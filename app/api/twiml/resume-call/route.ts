// /api/twiml/resume-call
// This endpoint returns TwiML to resume a call from hold

export async function POST(req: Request) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Please hold while we connect you to an agent.</Say>
    <Pause length="1"/>
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
    <Say voice="alice">Please hold while we connect you to an agent.</Say>
    <Pause length="1"/>
    <Redirect>/api/twiml/wait-for-agent</Redirect>
</Response>`

  return new Response(twiml, {
    headers: {
      "Content-Type": "text/xml",
    },
  })
}

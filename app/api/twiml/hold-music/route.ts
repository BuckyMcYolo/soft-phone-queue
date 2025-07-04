// /api/twiml/hold-music
// This endpoint returns TwiML to play hold music

export async function POST(req: Request) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play loop="0">http://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.wav</Play>
    <Redirect>/api/twiml/hold-music</Redirect>
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
    <Play loop="0">http://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.wav</Play>
    <Redirect>/api/twiml/hold-music</Redirect>
</Response>`

  return new Response(twiml, {
    headers: {
      "Content-Type": "text/xml",
    },
  })
}

//will handle generating twilio tokens for the client
const accountSid = process.env.TWILIO_SID
const authToken = process.env.TWILIO_TOKEN
const apiSID = process.env.TWILIO_API_KEY_SID
const apiSecret = process.env.TWILIO_API_KEY_SECRET

import twilio from "twilio"

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

export async function GET() {
  if (!accountSid || !authToken || !apiSID || !apiSecret) {
    return new Response("Missing Twilio credentials", { status: 500 })
  }
  try {
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_SID,
      incomingAllow: true,
    })

    const accessToken = new AccessToken(accountSid, apiSID, apiSecret, {
      identity: "user",
      ttl: 3600,
    })

    accessToken.addGrant(voiceGrant)

    return new Response(
      JSON.stringify({
        token: accessToken.toJwt(),
        identity: accessToken.identity,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    console.error("Error generating Twilio token:", error)
    return new Response("Failed to generate Twilio token", { status: 500 })
  }
}

import { getQueue } from "@/db/queries"

export async function GET() {
  try {
    const queue = await getQueue()
    if (!queue) {
      return new Response(JSON.stringify({ error: "Queue not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }
    return new Response(JSON.stringify(queue), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error in queue route:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

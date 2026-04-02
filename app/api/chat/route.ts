import Groq from "groq-sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ChatRole = "system" | "user" | "assistant"
type ChatMessage = { role: ChatRole; content: string }
type AssistantMode = "PLAN_TRIP" | "TRAVEL_QA"
type AssistantIntent = "plan_trip" | "travel_qa" | "mixed" | "unknown"

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY ?? "",
})

function sseFormat(data: any) {
  return `data: ${JSON.stringify(data)}\n\n`
}

function buildSystemPrompt(
  mode: AssistantMode,
  intent: AssistantIntent,
  planTripContext: Record<string, any>,
  qaContext: Record<string, any>
) {
  if (mode === "PLAN_TRIP") {
    return [
      "You are a travel planning assistant in PLAN_TRIP mode.",
      "Collect only required fields: destination(s), origin city, dates or duration, travelersCount.",
      "Ask exactly one missing field at a time.",
      "Do not ask for fields already provided.",
      "Keep responses concise and planning-focused.",
      `Plan context: ${JSON.stringify(planTripContext)}`,
      `Detected intent: ${intent}`,
    ].join(" ")
  }

  return [
    "You are a professional Travel Copilot in TRAVEL_QA mode.",
    "Answer with practical, decision-ready guidance for visa, safety, laws, SIM, currency, weather, culture, transport, and documents.",
    "Do not ask trip-planning intake questions unless strictly required to answer the user query.",
    "If location is missing for safety/laws/currency/SIM/weather/culture, ask only: Which country/city are you asking about?",
    "If visa/passport is asked and nationality is missing, ask only: Which nationality/passport do you hold?",
    "Response style: concise, structured, and professional.",
    "Default structure: 1) Direct answer 2) Key details/checklist 3) Risks or caveats 4) Next best action.",
    "When comparing options, use a compact table.",
    "If uncertain or rule-dependent, say what to verify and where to verify it (official embassy/airline/government portals).",
    `QA context: ${JSON.stringify(qaContext)}`,
    `Detected intent: ${intent}`,
  ].join(" ")
}

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response("Missing GROQ_API_KEY in .env.local", { status: 500 })
    }

    const body = await req.json()
    const messages: ChatMessage[] = body?.messages ?? []
    const mode: AssistantMode = body?.mode === "PLAN_TRIP" ? "PLAN_TRIP" : "TRAVEL_QA"
    const intent: AssistantIntent = body?.intent ?? "unknown"
    const planTripContext = body?.planTripContext ?? {}
    const qaContext = body?.qaContext ?? {}

    const system: ChatMessage = {
      role: "system",
      content: buildSystemPrompt(mode, intent, planTripContext, qaContext),
    }

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      stream: true,
      messages: [system, ...messages],
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(sseFormat({ type: "start" })))
          for await (const chunk of stream) {
            const token = chunk.choices?.[0]?.delta?.content ?? ""
            if (token) controller.enqueue(encoder.encode(sseFormat({ type: "token", token })))
          }
          controller.enqueue(encoder.encode(sseFormat({ type: "done" })))
          controller.close()
        } catch (err: any) {
          controller.enqueue(encoder.encode(sseFormat({ type: "error", message: err?.message ?? "Stream error" })))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  } catch (e: any) {
    return new Response(e?.message ?? "Unknown error", { status: 500 })
  }
}

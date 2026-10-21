import { generateImage, gateway } from "ai"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { notes } = (await req.json()) as { notes?: string }

    if (!notes || notes.trim().length < 4) {
      return Response.json(
        { error: "Please provide a longer eyewitness description." },
        { status: 400 },
      )
    }

    const prompt = [
      "A realistic monochrome graphite pencil forensic composite sketch of a human face,",
      "front-facing, neutral expression, hand-drawn police composite style on off-white paper,",
      "grayscale with subtle shading and no color, portrait framing, centered.",
      "The face must match this eyewitness description:",
      notes.trim(),
    ].join(" ")

    const { image } = await generateImage({
      model: gateway.imageModel("google/imagen-4.0-fast-generate-001"),
      prompt,
      aspectRatio: "4:5",
    })

    return Response.json({
      image: `data:${image.mediaType ?? "image/png"};base64,${image.base64}`,
    })
  } catch (err) {
    console.error("[v0] generate-portrait error:", err)
    const raw = err instanceof Error ? err.message : String(err)

    // AI Gateway blocks requests until a payment method is on file.
    if (/credit card|verification_required|payment/i.test(raw)) {
      return Response.json(
        {
          error:
            "AI image generation is locked: the Vercel AI Gateway needs a valid credit card on file to unlock your free credits. Add one under Vercel → AI, then try again.",
          needsBilling: true,
        },
        { status: 402 },
      )
    }

    return Response.json(
      { error: "Failed to generate portrait. Please try again." },
      { status: 500 },
    )
  }
}

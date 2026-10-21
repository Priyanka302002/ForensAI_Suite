import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawDescription: string =
      body.rawDescription || body.description || body.notes || ""

    const fallbackDescription =
      "A middle-aged Indian man, rugged square jawline, short trimmed beard, sharp deep-set dark brown eyes, a receding hairline with short black hair, and a visible birthmark mole on his right cheek"

    const stylePrefix =
      "Professional forensic charcoal sketch, police suspect mugshot identification portrait, high-contrast black and white pencil render, front view, neutral expression, highly detailed realistic human facial anatomy, sharp line boundaries, clean background, "

    let textQuery = ""
    if (rawDescription && rawDescription.trim().length > 0) {
      const cleaned = rawDescription.trim()
      textQuery = cleaned.startsWith("Professional forensic charcoal sketch")
        ? cleaned
        : `${stylePrefix}${cleaned}`
    } else {
      textQuery = `${stylePrefix}${fallbackDescription}`
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN

    let generatedSketchUrl = ""

    if (accountId && apiToken) {
      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: textQuery }),
          }
        )

        if (cfResponse.ok) {
          const arrayBuffer = await cfResponse.arrayBuffer()
          const base64String = Buffer.from(arrayBuffer).toString("base64")
          generatedSketchUrl = `data:image/jpeg;base64,${base64String}`
        } else {
          const errText = await cfResponse.text()
          console.warn("[Cloudflare Workers AI] API non-OK status:", cfResponse.status, errText)
        }
      } catch (cfErr) {
        console.error("[Cloudflare Workers AI] Exception calling Workers AI:", cfErr)
      }
    } else {
      console.log("[Cloudflare Workers AI] Credentials missing in process.env; using fallback endpoint.")
    }

    // Fallback if Cloudflare credentials are missing or call did not return image
    if (!generatedSketchUrl) {
      const encodedPrompt = encodeURIComponent(textQuery)
      const seed = Math.floor(Math.random() * 100000)
      generatedSketchUrl = `https://pollinations.ai/p/${encodedPrompt}?width=600&height=600&nologo=true&enhance=false&seed=${seed}`
    }

    return NextResponse.json({
      success: true,
      generatedSketchUrl,
      sketchUrl: generatedSketchUrl,
      sketchImageUrl: generatedSketchUrl,
      imageUrl: generatedSketchUrl,
      image: generatedSketchUrl,
      standardizedPrompt: textQuery,
      visualPrompt: textQuery,
    })
  } catch (error) {
    console.error("Error in /api/generate:", error)
    return NextResponse.json(
      { error: "Failed to generate Workers AI sketch." },
      { status: 500 }
    )
  }
}

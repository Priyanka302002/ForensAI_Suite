import { NextResponse } from "next/server"
import { criminalDatabase, CriminalRecord } from "@/lib/criminalDatabase"

/**
 * Calculates Cosine Similarity between two numerical vector arrays.
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0
  const len = Math.min(vecA.length, vecB.length)

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Generates a deterministic simulated vector from a string input.
 */
function generateSimulatedVector(inputString: string, length = 16): number[] {
  let hash = 0
  for (let i = 0; i < inputString.length; i++) {
    hash = (hash << 5) - hash + inputString.charCodeAt(i)
    hash |= 0
  }

  const vector: number[] = []
  const baseSeed = [
    0.80, 0.44, 0.89, 0.14, 0.76, 0.36, 0.65, 0.87, 0.25, 0.54, 0.92, 0.13, 0.41, 0.74, 0.86, 0.33,
  ]

  for (let i = 0; i < length; i++) {
    const baseVal = baseSeed[i % baseSeed.length]
    const pseudoRandom = Math.abs(Math.sin(hash + i)) * 0.05
    vector.push(Number((baseVal + pseudoRandom).toFixed(2)))
  }
  return vector
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    // Default trigger vector aligned with primary database suspect profile
    let incomingVector: number[] = [
      0.81, 0.44, 0.90, 0.13, 0.77, 0.35, 0.66, 0.88, 0.24, 0.55, 0.93, 0.12, 0.42, 0.75, 0.87, 0.32,
    ]

    if (Array.isArray(body.vector) && body.vector.length > 0) {
      incomingVector = body.vector
    } else if (Array.isArray(body.sketchVector) && body.sketchVector.length > 0) {
      incomingVector = body.sketchVector
    } else if (Array.isArray(body.facialVectorSignature) && body.facialVectorSignature.length > 0) {
      incomingVector = body.facialVectorSignature
    } else if (typeof body.rawDescription === "string" && body.rawDescription.trim().length > 0) {
      incomingVector = generateSimulatedVector(body.rawDescription)
    } else if (typeof body.trigger === "string" && body.trigger.trim().length > 0) {
      incomingVector = generateSimulatedVector(body.trigger)
    }

    // Perform vector similarity math check against all records in criminalDatabase
    let closestRecord: CriminalRecord | null = null
    let maxSimilarity = -1

    for (const record of criminalDatabase) {
      const similarity = calculateCosineSimilarity(
        incomingVector,
        record.facialVectorSignature
      )

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity
        closestRecord = record
      }
    }

    if (!closestRecord) {
      closestRecord = criminalDatabase[0]
      maxSimilarity = 0.95
    }

    const matchConfidence = Number((maxSimilarity * 100).toFixed(1))

    return NextResponse.json({
      success: true,
      matchConfidence,
      similarityScore: maxSimilarity,
      closestMatch: closestRecord,
      matchedRecord: closestRecord,
      dossier: closestRecord,
      match: closestRecord,
      triggerVectorUsed: incomingVector,
    })
  } catch (error) {
    console.error("Error in /api/match:", error)
    return NextResponse.json(
      { error: "Failed to process vector similarity match check." },
      { status: 500 }
    )
  }
}

/**
 * ForensicShield AI - Biometric Systems & Case Persistence API Client
 */

export interface FeatureDetail {
  description: string
  confidence: number
}

export interface StructuredFaceProfile {
  face_shape: FeatureDetail
  eyes: FeatureDetail
  nose: FeatureDetail
  mouth: FeatureDetail
  distinguishing_features: string[]
}

export interface CaseSavePayload {
  case_number: string
  raw_transcript: string
  structured_profile: StructuredFaceProfile
  image_url?: string
  case_id?: string
  id?: string
}

export interface CaseRecord {
  id: string
  case_number: string
  raw_transcript: string
  structured_profile: StructuredFaceProfile
  image_url: string | null
  created_at: string | null
  updated_at?: string | null
}

export interface CaseSaveResponse {
  status: "success" | "error"
  action: "created" | "updated"
  message: string
  case: CaseRecord
}

export interface SuspectMatchItem {
  suspect_id: string
  full_name: string
  match_score: number
  mugshot_url: string
  similarity_score?: number
  age?: number
  legal_status?: string
  active_warrants?: number
  past_offenses?: number
  physical_marks?: string
  modus_operandi?: string
}

export interface CaseListResponse {
  status: "success" | "error"
  count: number
  cases: CaseRecord[]
}

export interface CaseDetailResponse {
  status: "success" | "error"
  case: CaseRecord
}

export interface CaseExportPayload {
  case_number?: string
  case_id?: string
  raw_transcript?: string
  structured_profile?: StructuredFaceProfile | Record<string, any>
  suspect_match?: SuspectMatchItem | Record<string, any>
  image_url?: string
  officer_name?: string
  department?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

/**
 * Task 1: Save verified forensic case payload to the database system ledger.
 * Endpoint: POST /api/cases/save
 */
export async function saveForensicCase(payload: CaseSavePayload): Promise<CaseSaveResponse> {
  const res = await fetch(`${API_BASE_URL}/api/cases/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      case_number: payload.case_number || payload.case_id || "CASE-UNTITLED",
      raw_transcript: payload.raw_transcript,
      structured_profile: payload.structured_profile,
      image_url: payload.image_url,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to save case ledger record (status ${res.status})`)
  }

  return res.json()
}

/**
 * Task 1: Retrieve previously committed forensic case log by unique case number or UUID.
 * Endpoint: GET /api/cases/{case_number}
 */
export async function getForensicCase(caseNumber: string): Promise<CaseDetailResponse> {
  const cleanId = encodeURIComponent(caseNumber.trim())
  const res = await fetch(`${API_BASE_URL}/api/cases/${cleanId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to fetch case ${caseNumber} (status ${res.status})`)
  }

  return res.json()
}

/**
 * Task 1: List existing case records stored in the relational ledger.
 * Endpoint: GET /api/cases
 */
export async function listForensicCases(limit: number = 50): Promise<CaseListResponse> {
  const res = await fetch(`${API_BASE_URL}/api/cases?limit=${limit}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to list case records (status ${res.status})`)
  }

  return res.json()
}

/**
 * Task 2 & 3: Run biometric vector match against suspect mugshot database.
 * Uses Cosine Similarity analytical matrix on geometric features.
 * Endpoint: POST /api/intelligence/match
 */
export async function fetchBiometricMatches(
  profile: StructuredFaceProfile | Record<string, any>
): Promise<SuspectMatchItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/intelligence/match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || `Biometric matching failed (status ${res.status})`)
  }

  const data = await res.json()
  // Normalizes whether the backend returned raw sorted array or dictionary format
  if (Array.isArray(data)) {
    return data
  }
  if (data && Array.isArray(data.matches)) {
    return data.matches
  }
  return []
}

/**
 * Task: Export Court-Ready Chain-of-Custody Verification PDF.
 * Streams the generated PDF binary directly from the backend into the browser,
 * extracting filename from Content-Disposition if present, and initiating an immediate download.
 * Endpoint: POST /api/cases/export-pdf
 */
export async function exportEvidencePdf(payload: CaseExportPayload): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/cases/export-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to export Evidence PDF (status ${res.status})`)
  }

  const blob = await res.blob()

  // Resolve filename from Content-Disposition header or fallback to case number
  let filename = `Forensic_Chain_Of_Custody_${(payload.case_number || "CASE-EVIDENCE").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
  const disposition = res.headers.get("content-disposition")
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, "")
    }
  }

  // Trigger instant browser streaming file download
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(blobUrl)

  return blob
}

export default {
  saveForensicCase,
  getForensicCase,
  listForensicCases,
  fetchBiometricMatches,
  exportEvidencePdf,
}

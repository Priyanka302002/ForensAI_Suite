"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Mic,
  MicOff,
  Grid3x3,
  Sparkles,
  AudioWaveform,
  Loader2,
  AlertTriangle,
  ScanFace,
  BrainCircuit,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Tag,
  Plus,
  X,
  FileText,
  ShieldAlert,
  Server,
  RefreshCw,
  Database,
  Save,
  FolderOpen,
  ArrowRight,
  FileCheck2,
} from "lucide-react"
import {
  saveForensicCase,
  getForensicCase,
  listForensicCases,
  exportEvidencePdf,
  type CaseRecord,
} from "@/src/services/forensicApi" 
import { GlassCard, PageHeader } from "./primitives"
import { cn } from "@/lib/utils"

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

const DEFAULT_PROFILE: StructuredFaceProfile = {
  face_shape: {
    description: "Smooth oval face structure, tapered jawline",
    confidence: 0.95,
  },
  eyes: {
    description: "Large symmetrical dark eyes with defined orbital sockets",
    confidence: 0.92,
  },
  nose: {
    description: "Straight nasal bridge, proportionate alar base",
    confidence: 0.88,
  },
  mouth: {
    description: "Neutral relaxed lips, balanced vermilion border",
    confidence: 0.85,
  },
  distinguishing_features: [
    "High cheekbones",
    "Long straight black hair parted down middle",
    "Estimated age 25 years",
  ],
}

export function InterviewCanvas() {
  const [caseId, setCaseId] = useState("CASE-2026-0884")
  const [recording, setRecording] = useState(false)
  const [showMatrix, setShowMatrix] = useState(true)
  const [notes, setNotes] = useState(
    "Young South Asian woman, approx. 25 years, smooth oval face, large symmetrical dark eyes, long straight black hair parted down the middle, high cheekbones.",
  )
  const [portrait, setPortrait] = useState("/suspect-sketch.png")
  const [parsing, setParsing] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [structuredProfile, setStructuredProfile] = useState<StructuredFaceProfile>(DEFAULT_PROFILE)
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string | null>(null)
  const [newFeatureText, setNewFeatureText] = useState("")
  const [savingCase, setSavingCase] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [availableCases, setAvailableCases] = useState<CaseRecord[]>([])
  const [selectedCaseToLoad, setSelectedCaseToLoad] = useState("")

  const recognitionRef = useRef<any>(null)
  const baseNotesRef = useRef("")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

  // Check backend server connection status on mount
  useEffect(() => {
    let isMounted = true
    const checkServerHealth = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/health`, { method: "GET" })
        if (isMounted) setServerOnline(res.ok)
      } catch {
        if (isMounted) setServerOnline(false)
      }
    }
    checkServerHealth()
    const timer = setInterval(checkServerHealth, 15000)

    // Load available database cases for dynamic reloading
    listForensicCases(20)
      .then((res) => {
        if (res && res.cases) setAvailableCases(res.cases)
      })
      .catch(() => {
        /* silent catch */
      })

    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [apiUrl])

  // Task 1: Commit case payload to relational database ledger (POST /api/cases/save)
  const handleSaveCase = useCallback(async () => {
    if (!notes.trim()) {
      setError("Cannot save an empty transcript to the evidence ledger.")
      return
    }
    setSavingCase(true)
    setError(null)
    setSaveSuccess(null)
    try {
      const res = await saveForensicCase({
        case_number: caseId.trim() || "CASE-2026-0884",
        raw_transcript: notes.trim(),
        structured_profile: structuredProfile,
        image_url: portrait,
      })
      setSaveSuccess(`Committed to ledger: ${res.case.case_number} (ID: ${res.case.id.slice(0, 8)}…)`)
      localStorage.setItem("forensai_active_profile", JSON.stringify(structuredProfile))
      localStorage.setItem("forensai_active_sketch", portrait)
      localStorage.setItem("forensai_case_id", res.case.case_number)
      localStorage.setItem("forensai_active_transcript", notes.trim())

      // Refresh list
      listForensicCases(20).then((r) => {
        if (r && r.cases) setAvailableCases(r.cases)
      }).catch(() => {})
    } catch (err) {
      console.error("[ForensicShield] Save Case Error:", err)
      setError(err instanceof Error ? err.message : "Failed to commit case to database ledger.")
    } finally {
      setSavingCase(false)
    }
  }, [caseId, notes, structuredProfile, portrait])

  // Task 1: Reload previous investigation log dynamically (GET /api/cases/{case_number})
  const handleLoadCase = useCallback(async (caseNumToLoad: string) => {
    if (!caseNumToLoad.trim()) return
    setError(null)
    setSaveSuccess(null)
    try {
      const res = await getForensicCase(caseNumToLoad.trim())
      if (res && res.case) {
        const c = res.case
        setCaseId(c.case_number)
        setNotes(c.raw_transcript)
        setStructuredProfile(c.structured_profile)
        if (c.image_url) setPortrait(c.image_url)
        setSaveSuccess(`Successfully loaded case ${c.case_number} from database ledger.`)
        localStorage.setItem("forensai_active_profile", JSON.stringify(c.structured_profile))
        if (c.image_url) localStorage.setItem("forensai_active_sketch", c.image_url)
        localStorage.setItem("forensai_case_id", c.case_number)
        localStorage.setItem("forensai_active_transcript", c.raw_transcript)
      }
    } catch (err) {
      console.error("[ForensicShield] Load Case Error:", err)
      setError(err instanceof Error ? err.message : `Failed to load case ${caseNumToLoad}`)
    }
  }, [])

  // Export court-ready Chain-of-Custody verification PDF from Interview Canvas
  const handleExportEvidence = useCallback(async () => {
    setExportingPdf(true)
    setError(null)
    setSaveSuccess(null)
    try {
      localStorage.setItem("forensai_active_transcript", notes.trim())
      localStorage.setItem("forensai_active_profile", JSON.stringify(structuredProfile))
      if (portrait) localStorage.setItem("forensai_active_sketch", portrait)
      localStorage.setItem("forensai_case_id", caseId.trim() || "CASE-2026-0884")

      await exportEvidencePdf({
        case_number: caseId.trim() || "CASE-2026-0884",
        raw_transcript: notes.trim(),
        structured_profile: structuredProfile,
        image_url: portrait,
        officer_name: "Det. R. Miller (#4892)",
        department: "Forensic Biometrics Division",
      })
      setSaveSuccess(
        `Court-ready Chain-of-Custody verification file downloaded for ${caseId.trim() || "CASE-2026-0884"}.`,
      )
    } catch (err) {
      console.error("[InterviewCanvas] PDF Export Error:", err)
      setError(err instanceof Error ? err.message : "Failed to export Evidence PDF.")
    } finally {
      setExportingPdf(false)
    }
  }, [caseId, notes, structuredProfile, portrait])

  // Browser SpeechRecognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      let transcript = ""
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      const prefix = baseNotesRef.current
      setNotes((prefix ? prefix.trimEnd() + " " : "") + transcript)
    }

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access denied. Enable permission to use the transcriber.")
      }
      setRecording(false)
    }

    recognition.onend = () => setRecording(false)

    recognitionRef.current = recognition
    return () => {
      try {
        recognition.stop()
      } catch {
        /* noop */
      }
    }
  }, [])

  const toggleRecording = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (recording) {
      recognition.stop()
      setRecording(false)
    } else {
      setError(null)
      baseNotesRef.current = notes
      try {
        recognition.start()
        setRecording(true)
      } catch {
        /* already started */
      }
    }
  }, [recording, notes])

  // 1. Task 2: Trigger /api/parse-description passing case_id and raw_transcript
  const parseDescription = useCallback(async () => {
    if (!notes.trim()) {
      setError("Please provide an eyewitness description to parse.")
      return
    }
    setParsing(true)
    setError(null)
    setWarning(null)
    try {
      const res = await fetch(`${apiUrl}/api/parse-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId.trim() || "CASE-GEN-01",
          raw_transcript: notes.trim(),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Backend returned status ${res.status}`)
      }

      const data: StructuredFaceProfile = await res.json()
      setStructuredProfile(data)
      try {
        localStorage.setItem("forensai_active_profile", JSON.stringify(data))
        localStorage.setItem("forensai_case_id", caseId.trim() || "CASE-2026-0884")
      } catch {}
    } catch (err) {
      console.error("[ForensicShield] Biometrics Parse Error:", err)
      setError(err instanceof Error ? err.message : "Failed to parse description")
    } finally {
      setParsing(false)
    }
  }, [notes, caseId, apiUrl])

  // 2. Task 2: Trigger /api/render-sketch forwarding verified structured layout
  const renderSketch = useCallback(async () => {
    if (!structuredProfile) {
      setError("Please extract or specify a biometric profile first.")
      return
    }
    setRendering(true)
    setError(null)
    setWarning(null)
    try {
      const res = await fetch(`${apiUrl}/api/render-sketch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structured_profile: structuredProfile,
        }),
      })

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}))
        throw new Error(errPayload.detail || `Rendering service error (${res.status})`)
      }

      const data = await res.json()
      if (data.image_url) {
        setPortrait(data.image_url)
        try {
          localStorage.setItem("forensai_active_sketch", data.image_url)
        } catch {}
      }
      if (data.final_prompt_sent_to_ai) {
        setLastGeneratedPrompt(data.final_prompt_sent_to_ai)
      }
      if (data.warning) {
        setWarning(data.warning)
      }
    } catch (err) {
      console.error("[ForensicShield] Render Sketch Error:", err)
      setError(err instanceof Error ? err.message : "Failed to render forensic composite sketch")
    } finally {
      setRendering(false)
    }
  }, [structuredProfile, apiUrl])

  // Quick 1-click execution: Parse & Render sequentially
  const handleFullPipeline = useCallback(async () => {
    if (!notes.trim()) {
      setError("Please enter or transcribe an eyewitness statement.")
      return
    }
    setParsing(true)
    setError(null)
    setWarning(null)
    try {
      const parseRes = await fetch(`${apiUrl}/api/parse-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId.trim() || "CASE-GEN-01",
          raw_transcript: notes.trim(),
        }),
      })

      if (!parseRes.ok) {
        const errorData = await parseRes.json().catch(() => ({}))
        throw new Error(errorData.detail || `Parse failed with status ${parseRes.status}`)
      }

      const parsedProfile: StructuredFaceProfile = await parseRes.json()
      setStructuredProfile(parsedProfile)
      setParsing(false)

      // Directly render with newly parsed profile
      setRendering(true)
      const renderRes = await fetch(`${apiUrl}/api/render-sketch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structured_profile: parsedProfile,
        }),
      })

      if (!renderRes.ok) {
        const errPayload = await renderRes.json().catch(() => ({}))
        throw new Error(errPayload.detail || `Rendering service error (${renderRes.status})`)
      }

      const renderData = await renderRes.json()
      if (renderData.image_url) {
        setPortrait(renderData.image_url)
      }
      if (renderData.final_prompt_sent_to_ai) {
        setLastGeneratedPrompt(renderData.final_prompt_sent_to_ai)
      }
      if (renderData.warning) {
        setWarning(renderData.warning)
      }
    } catch (err) {
      console.error("[ForensicShield] Full Pipeline Error:", err)
      setError(err instanceof Error ? err.message : "Pipeline failed")
    } finally {
      setParsing(false)
      setRendering(false)
    }
  }, [notes, caseId, apiUrl])

  // Helper to add distinguishing feature tag
  const addFeature = () => {
    if (!newFeatureText.trim()) return
    setStructuredProfile((prev) => ({
      ...prev,
      distinguishing_features: [...prev.distinguishing_features, newFeatureText.trim()],
    }))
    setNewFeatureText("")
  }

  // Helper to remove distinguishing feature tag
  const removeFeature = (idx: number) => {
    setStructuredProfile((prev) => ({
      ...prev,
      distinguishing_features: prev.distinguishing_features.filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="animate-fade-up">
      {/* Top Header with Case Identifier and Server Link Status */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <PageHeader
          eyebrow="Core Workspace"
          title="Live Eyewitness Interview & Biometric Canvas"
          description="Transform natural language eyewitness testimony into objective facial geometry profiles and render high-fidelity forensic sketches via DALL-E 3."
        />
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-hairline bg-panel/70 px-3.5 py-2">
            <Server className="h-3.5 w-3.5 text-cyber" />
            <span className="text-xs text-slate-400">Backend:</span>
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-semibold",
                serverOnline === true
                  ? "text-emerald-400"
                  : serverOnline === false
                    ? "text-rose-400"
                    : "text-amber-400",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  serverOnline === true
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : serverOnline === false
                      ? "bg-rose-400"
                      : "bg-amber-400 animate-pulse",
                )}
              />
              {serverOnline === true ? "Connected (Port 8000)" : serverOnline === false ? "Offline" : "Checking…"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column: Eyewitness Transcript & Voice Transcriber (7 cols) */}
        <div className="flex flex-col gap-6 xl:col-span-7">
          <GlassCard>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyber/40 bg-cyber/10 text-cyber shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)]">
                  <AudioWaveform className="h-[18px] w-[18px]" />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-white">AI Voice Transcriber</span>
                  <span className="text-[11px] text-slate-400">Real-time speech-to-text intake</span>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <div className="flex items-center rounded-xl border border-hairline bg-canvas/70 px-2.5 py-1 text-xs text-slate-300">
                  <span className="mr-1.5 text-[10px] uppercase tracking-wider text-slate-500">Case ID</span>
                  <input
                    type="text"
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="w-28 bg-transparent text-xs font-semibold text-cyber focus:outline-none"
                    placeholder="CASE-XXXX"
                  />
                </div>

                {/* Task 1: Save case to relational database ledger */}
                <button
                  type="button"
                  onClick={handleSaveCase}
                  disabled={savingCase || parsing || rendering}
                  className="flex items-center gap-1.5 rounded-xl border border-cyber/40 bg-cyber/15 px-3 py-1.5 text-xs font-semibold text-cyber transition-all hover:bg-cyber/25 disabled:opacity-50"
                  title="Commit verified case record to PostgreSQL database ledger"
                >
                  {savingCase ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  <span>Save Ledger</span>
                </button>

                {/* Export Court-Ready Chain of Custody PDF */}
                <button
                  type="button"
                  onClick={handleExportEvidence}
                  disabled={exportingPdf || savingCase || parsing || rendering}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/25 hover:shadow-[0_0_15px_-2px_rgba(52,211,153,0.4)] disabled:opacity-50"
                  title="Export court-ready Chain-of-Custody PDF verification file"
                >
                  {exportingPdf ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileCheck2 className="h-3 w-3" />
                  )}
                  <span>{exportingPdf ? "Exporting…" : "Export Evidence File"}</span>
                </button>

                {/* Task 1: Quick load previous case from database ledger */}
                {availableCases.length > 0 && (
                  <div className="flex items-center rounded-xl border border-hairline bg-canvas/70 px-2 py-1 text-xs">
                    <FolderOpen className="h-3 w-3 mr-1 text-slate-400" />
                    <select
                      value={selectedCaseToLoad}
                      onChange={(e) => {
                        setSelectedCaseToLoad(e.target.value)
                        handleLoadCase(e.target.value)
                      }}
                      className="bg-transparent text-[11px] text-slate-300 focus:outline-none cursor-pointer max-w-[110px]"
                    >
                      <option value="" className="bg-canvas text-slate-400">Load Case…</option>
                      {availableCases.map((c) => (
                        <option key={c.id} value={c.case_number} className="bg-canvas text-white">
                          {c.case_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={toggleRecording}
                  disabled={!speechSupported}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    recording
                      ? "bg-alert/15 text-alert ring-1 ring-alert/40 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                      : "bg-white/5 text-slate-300 ring-1 ring-hairline hover:text-white",
                  )}
                >
                  {recording ? <Mic className="h-3.5 w-3.5 animate-pulse" /> : <MicOff className="h-3.5 w-3.5" />}
                  {recording ? "Listening…" : speechSupported ? "Start Mic" : "Unsupported"}
                </button>
              </div>
            </div>

            <Waveform active={recording} />

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Raw Eyewitness Transcript (Unstructured Testimony)
                </label>
                <span className="text-[11px] text-slate-500">
                  {notes.length} characters
                </span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-hairline bg-canvas/70 p-3.5 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 transition-colors focus:border-cyber/60 focus:outline-none focus:ring-1 focus:ring-cyber/30"
                placeholder="Speak into microphone or paste witness testimony here…"
              />
            </div>

            {saveSuccess && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div className="flex-1 leading-relaxed font-medium">{saveSuccess}</div>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            {warning && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="flex-1 leading-relaxed">{warning}</div>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={parseDescription}
                disabled={parsing || rendering}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyber/40 bg-cyber/15 py-2.5 text-xs font-semibold text-cyber transition-all hover:bg-cyber/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Extracting Biometrics…
                  </>
                ) : (
                  <>
                    <BrainCircuit className="h-3.5 w-3.5" />
                    1. Parse Biometric Profile
                  </>
                )}
              </button>

              <button
                onClick={handleFullPipeline}
                disabled={parsing || rendering}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyber py-2.5 text-xs font-semibold text-slate-950 transition-all hover:bg-cyber/90 hover:shadow-[0_0_20px_-4px_rgba(6,182,212,0.8)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rendering ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Synthesizing Composite…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Quick Generate (Parse & Render)
                  </>
                )}
              </button>
            </div>
          </GlassCard>

          {/* Structured Biometric Facial Profile Dashboard */}
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyber/40 bg-cyber/10 text-cyber">
                  <Sliders className="h-4 w-4" />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-white">Biometric Facial Parameters</span>
                  <span className="text-[11px] text-slate-400">Structured physical geometry extracted from testimony</span>
                </div>
              </div>
              <span className="rounded-full border border-cyber/30 bg-cyber/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyber">
                Pydantic Validated
              </span>
            </div>

            {/* Biometric Feature Grid */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <BiometricCard
                label="Face Shape"
                feature={structuredProfile.face_shape}
                onChange={(desc) =>
                  setStructuredProfile((prev) => ({
                    ...prev,
                    face_shape: { ...prev.face_shape, description: desc },
                  }))
                }
              />
              <BiometricCard
                label="Eyes & Brows"
                feature={structuredProfile.eyes}
                onChange={(desc) =>
                  setStructuredProfile((prev) => ({
                    ...prev,
                    eyes: { ...prev.eyes, description: desc },
                  }))
                }
              />
              <BiometricCard
                label="Nose Structure"
                feature={structuredProfile.nose}
                onChange={(desc) =>
                  setStructuredProfile((prev) => ({
                    ...prev,
                    nose: { ...prev.nose, description: desc },
                  }))
                }
              />
              <BiometricCard
                label="Mouth & Lips"
                feature={structuredProfile.mouth}
                onChange={(desc) =>
                  setStructuredProfile((prev) => ({
                    ...prev,
                    mouth: { ...prev.mouth, description: desc },
                  }))
                }
              />
            </div>

            {/* Distinguishing Features Tag Deck */}
            <div className="mt-4 rounded-xl border border-hairline bg-canvas/50 p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Tag className="h-3.5 w-3.5 text-cyber" />
                  <span>Distinguishing Features & Accessories</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {structuredProfile.distinguishing_features.length} features logged
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {structuredProfile.distinguishing_features.map((feat, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyber/30 bg-cyber/10 px-2.5 py-1 text-xs text-cyber transition-colors hover:border-cyber/60"
                  >
                    <span>{feat}</span>
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      className="ml-1 text-cyber/60 hover:text-white"
                      aria-label="Remove feature"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addFeature()
                    }
                  }}
                  placeholder="Add distinguishing mark (e.g. scar on eyebrow, glasses)…"
                  className="flex-1 rounded-lg border border-hairline bg-panel/80 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyber/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex items-center gap-1 rounded-lg border border-hairline bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyber/40 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            {/* Task 2: Sketch generation execution button */}
            <button
              onClick={renderSketch}
              disabled={rendering || parsing}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyber py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-cyber/90 hover:shadow-[0_0_25px_-4px_rgba(6,182,212,0.8)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rendering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Forensic Composite via Stable Diffusion…
                </>
              ) : (
                <>
                  <ScanFace className="h-4 w-4" />
                  2. Render Forensic Sketch from Structured Profile
                </>
              )}
            </button>
          </GlassCard>
        </div>

        {/* Right Column: Portrait Preview & Biometric Alignment Matrix (5 cols) */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <GlassCard className="flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyber/40 bg-cyber/10 text-cyber shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)]">
                  <Grid3x3 className="h-[18px] w-[18px]" />
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-white">Forensic Sketch Output</span>
                  <span className="text-[11px] text-slate-400">Stable Diffusion police sketch composite</span>
                </div>
              </div>
              <span className="rounded-full border border-hairline bg-canvas/80 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                1024×1024
              </span>
            </div>

            {/* Image Canvas with Overlay */}
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={portrait || "/suspect-sketch.png"}
                alt="AI-generated forensic composite sketch of the suspect"
                className="absolute inset-0 h-full w-full rounded-2xl object-cover opacity-95 transition-opacity duration-300"
              />

              {showMatrix && <MatrixOverlay />}

              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-cyber/40 bg-canvas/80 px-3 py-1 text-[11px] font-semibold text-cyber backdrop-blur-md">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-cyber" />
                OFFICIAL EVIDENCE COMPOSITE
              </div>

              {rendering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/80 backdrop-blur-md">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-cyber" />
                    <ScanFace className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-cyber" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyber">
                    Rendering Stable Diffusion Sketch…
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Applying charcoal pencil & forensic constraint weights
                  </span>
                </div>
              )}
            </div>

            {/* Matrix Toggle Controls */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-hairline bg-canvas/50 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Biometric Coordinate Matrix</span>
                <span className="text-[11px] text-slate-400">Facial anchor alignment overlay</span>
              </div>
              <button
                role="switch"
                aria-checked={showMatrix}
                aria-label="Toggle alignment matrix"
                onClick={() => setShowMatrix((v) => !v)}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors duration-300",
                  showMatrix ? "bg-cyber" : "bg-slate-700",
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300",
                    showMatrix ? "left-6" : "left-1",
                  )}
                />
              </button>
            </div>

            {/* Clean Image Source Path & Details */}
            <div className="mt-4 rounded-xl border border-hairline bg-canvas/40 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Resolved Image Source:</span>
                <a
                  href={portrait}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-mono text-[11px] text-cyber hover:underline"
                >
                  <span className="max-w-[200px] truncate">{portrait}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {lastGeneratedPrompt && (
                <div className="mt-2.5 border-t border-hairline pt-2 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Prompt Sent to AI: </span>
                  <p className="mt-1 line-clamp-3 font-mono text-[10px] leading-relaxed text-slate-400">
                    {lastGeneratedPrompt}
                  </p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

function BiometricCard({
  label,
  feature,
  onChange,
}: {
  label: string
  feature: FeatureDetail
  onChange: (desc: string) => void
}) {
  const confidencePercent = Math.round((feature?.confidence ?? 0.8) * 100)

  return (
    <div className="flex flex-col justify-between rounded-xl border border-hairline bg-canvas/60 p-3.5 transition-colors hover:border-cyber/30">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">{label}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              confidencePercent >= 85
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : confidencePercent >= 70
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border border-slate-500/30 bg-slate-500/10 text-slate-400",
            )}
          >
            {confidencePercent}% Confidence
          </span>
        </div>
        <textarea
          value={feature?.description || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-hairline bg-panel/70 p-2 text-xs leading-relaxed text-slate-300 transition-colors focus:border-cyber/50 focus:outline-none"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-cyber transition-all duration-500"
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-slate-500">score: {feature?.confidence?.toFixed(2) ?? "1.00"}</span>
      </div>
    </div>
  )
}

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 40 })
  return (
    <div className="flex h-20 items-center justify-center gap-1 rounded-xl border border-hairline bg-canvas/60 px-3">
      {bars.map((_, i) => (
        <span
          key={i}
          className={cn("w-1 rounded-full bg-cyber", active ? "" : "opacity-30")}
          style={{
            height: "100%",
            transformOrigin: "center",
            animation: active
              ? `waveform ${0.6 + (i % 5) * 0.18}s ease-in-out ${i * 0.05}s infinite`
              : "none",
          }}
        />
      ))}
    </div>
  )
}

function MatrixOverlay() {
  const anchors = [
    { x: "34%", y: "38%" },
    { x: "66%", y: "38%" },
    { x: "50%", y: "56%" },
    { x: "38%", y: "72%" },
    { x: "62%", y: "72%" },
  ]
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6,182,212,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.35) 1px, transparent 1px)",
          backgroundSize: "9% 9%",
        }}
      />
      {/* Scan line */}
      <div
        className="absolute left-0 h-[2px] w-full bg-cyber/70 shadow-[0_0_12px_2px_rgba(6,182,212,0.7)]"
        style={{ animation: "scan-line 3s linear infinite" }}
      />
      {/* Anchor points */}
      {anchors.map((a, i) => (
        <span
          key={i}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyber bg-cyber/30 shadow-[0_0_10px_2px_rgba(6,182,212,0.7)]"
          style={{ left: a.x, top: a.y }}
        />
      ))}
    </div>
  )
}

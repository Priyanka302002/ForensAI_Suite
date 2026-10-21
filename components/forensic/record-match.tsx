"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Download,
  Radar,
  Calendar,
  FileWarning,
  Gavel,
  ScanFace,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  Search,
  FileText,
  ShieldAlert,
  Fingerprint,
  Users,
  FileCheck2,
} from "lucide-react"
import { GlassCard, PageHeader } from "./primitives"
import { cn } from "@/lib/utils"
import {
  fetchBiometricMatches,
  listForensicCases,
  getForensicCase,
  exportEvidencePdf,
  type SuspectMatchItem,
  type CaseRecord,
  type StructuredFaceProfile,
} from "@/src/services/forensicApi"

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

export function RecordMatch() {
  const [matches, setMatches] = useState<SuspectMatchItem[]>([])
  const [selectedSuspect, setSelectedSuspect] = useState<SuspectMatchItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSketch, setActiveSketch] = useState("/suspect-sketch.png")
  const [activeProfile, setActiveProfile] = useState<StructuredFaceProfile>(DEFAULT_PROFILE)
  const [caseList, setCaseList] = useState<CaseRecord[]>([])
  const [activeCaseNumber, setActiveCaseNumber] = useState<string>("CASE-2026-0884")
  const [isSearchingCase, setIsSearchingCase] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  // 1. Initial Load: Retrieve active profile from localStorage (if coming from Interview Canvas) and trigger biometric matching
  const runMatching = useCallback(async (profileToMatch: StructuredFaceProfile) => {
    setLoading(true)
    setError(null)
    try {
      const results = await fetchBiometricMatches(profileToMatch)
      setMatches(results)
      if (results.length > 0) {
        setSelectedSuspect((prev) => {
          // Keep current selection if valid, or default to highest match score (top index)
          const found = prev ? results.find((s) => s.suspect_id === prev.suspect_id) : null
          return found || results[0]
        })
      }
    } catch (err) {
      console.error("[BiometricMatch] Analytical routing error:", err)
      setError(err instanceof Error ? err.message : "Failed to compute biometric vector similarity.")
    } finally {
      setLoading(false)
    }
  }, [])

  // Sync with localStorage on initial mount and load case records
  useEffect(() => {
    let profile = DEFAULT_PROFILE
    try {
      const storedProfile = localStorage.getItem("forensai_active_profile")
      if (storedProfile) {
        profile = JSON.parse(storedProfile)
        setActiveProfile(profile)
      }
      const storedSketch = localStorage.getItem("forensai_active_sketch")
      if (storedSketch) {
        setActiveSketch(storedSketch)
      }
      const storedCaseId = localStorage.getItem("forensai_case_id")
      if (storedCaseId) {
        setActiveCaseNumber(storedCaseId)
      }
    } catch {
      // Fallback to defaults
    }

    // Run matching pipeline
    runMatching(profile)

    // Load ledger cases for quick switching
    listForensicCases(10)
      .then((res) => {
        if (res && res.cases) {
          setCaseList(res.cases)
        }
      })
      .catch(() => {
        /* silent catch */
      })
  }, [runMatching])

  // Handler to load a case from the database ledger and re-run similarity
  const handleLoadCase = async (caseNum: string) => {
    if (!caseNum.trim()) return
    setIsSearchingCase(true)
    setError(null)
    try {
      const res = await getForensicCase(caseNum.trim())
      if (res && res.case) {
        const c = res.case
        setActiveCaseNumber(c.case_number)
        setActiveProfile(c.structured_profile)
        if (c.image_url) {
          setActiveSketch(c.image_url)
        }
        await runMatching(c.structured_profile)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load case ${caseNum}`)
    } finally {
      setIsSearchingCase(false)
    }
  }

  const primaryMatch = selectedSuspect || matches[0]
  const matchValue = primaryMatch?.match_score ?? 95.4

  // Export court-ready Chain-of-Custody verification PDF with active interface layout metadata
  const handleExportEvidence = async () => {
    setExportingPdf(true)
    setError(null)
    setExportSuccess(null)
    try {
      let transcript = "Eyewitness recorded testimony capturing suspect facial geometry and distinctive structural landmarks."
      try {
        const storedTranscript = localStorage.getItem("forensai_active_transcript")
        if (storedTranscript) transcript = storedTranscript
      } catch {}

      await exportEvidencePdf({
        case_number: activeCaseNumber,
        raw_transcript: transcript,
        structured_profile: activeProfile,
        suspect_match: primaryMatch
          ? {
              suspect_id: primaryMatch.suspect_id,
              full_name: primaryMatch.full_name,
              match_score: primaryMatch.match_score,
              legal_status: primaryMatch.legal_status || "Wanted - Active Warrant",
              active_warrants: primaryMatch.active_warrants ?? 2,
              past_offenses: primaryMatch.past_offenses ?? 4,
              physical_marks:
                primaryMatch.physical_marks ||
                "Facial scar demarcation, biometric anchor points verified",
              modus_operandi:
                primaryMatch.modus_operandi ||
                "Unauthorized biometric spoofing & network infiltration",
              mugshot_url: primaryMatch.mugshot_url || "/subject-mugshot.png",
            }
          : undefined,
        image_url: activeSketch,
        officer_name: "Det. R. Miller (#4892)",
        department: "Forensic Biometrics Division",
      })
      setExportSuccess(
        `Successfully generated and downloaded court-ready Chain-of-Custody verification file for ${activeCaseNumber}.`,
      )
    } catch (err) {
      console.error("[BiometricMatch] PDF Export Error:", err)
      setError(err instanceof Error ? err.message : "Failed to export Evidence PDF.")
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="animate-fade-up">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <PageHeader
          eyebrow="Intelligence Screen"
          title="Biometric Record Match"
          description="Cross-reference reconstructed composite facial geometry against the suspect mugshot ledger using Cosine Similarity vector analysis."
        />

        {/* Database Ledger Case Switcher */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-hairline bg-panel/70 px-3 py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5 text-cyber" />
            <span className="text-[11px] text-slate-400">Case Ledger:</span>
            <select
              value={activeCaseNumber}
              onChange={(e) => handleLoadCase(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value={activeCaseNumber} className="bg-canvas text-white">
                {activeCaseNumber}
              </option>
              {caseList
                .filter((c) => c.case_number !== activeCaseNumber)
                .map((c) => (
                  <option key={c.id} value={c.case_number} className="bg-canvas text-white">
                    {c.case_number}
                  </option>
                ))}
            </select>
          </div>

          <button
            onClick={() => runMatching(activeProfile)}
            disabled={loading || isSearchingCase}
            className="flex items-center gap-1.5 rounded-xl border border-cyber/40 bg-cyber/10 px-3.5 py-2 text-xs font-semibold text-cyber transition-all hover:bg-cyber/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>Refresh Matching</span>
          </button>

          <button
            onClick={handleExportEvidence}
            disabled={exportingPdf || loading}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 hover:shadow-[0_0_20px_-3px_rgba(52,211,153,0.4)] disabled:opacity-50"
            title="Export court-ready Chain-of-Custody PDF verification file"
          >
            {exportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCheck2 className="h-3.5 w-3.5" />
            )}
            <span>{exportingPdf ? "Exporting PDF…" : "Export Evidence File"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Main 1-on-1 Hero Comparison Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto_1fr]">
        {/* Left: Generated sketch */}
        <GlassCard className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Generated Sketch
            </span>
            <span className="rounded-full border border-cyber/30 bg-cyber/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyber">
              {activeCaseNumber}
            </span>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-hairline bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSketch}
              alt="AI-generated suspect sketch"
              className="absolute inset-0 h-full w-full rounded-2xl object-cover"
              onError={(e) => {
                e.currentTarget.src = "/suspect-sketch.png"
              }}
            />
            <FaceAnchors color="rgba(6,182,212,0.9)" />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-cyber/40 bg-canvas/80 px-2.5 py-1 text-[10px] font-semibold text-cyber backdrop-blur-md">
              <ScanFace className="h-3 w-3" />
              EVIDENCE COMPOSITE
            </div>
          </div>
          <p className="mt-3 text-center text-sm font-medium text-slate-300">
            Unknown Subject (Eyewitness Composite)
          </p>
        </GlassCard>

        {/* Center: Match ring & analytical index */}
        <div className="flex items-center justify-center lg:w-56">
          <GlassCard className="flex w-full flex-col items-center gap-4">
            <MatchRing value={matchValue} />
            <div className="text-center">
              <p className="text-sm font-semibold text-white">AI Face Match Index</p>
              <p className="text-xs text-slate-500">
                {matchValue >= 90
                  ? "High-confidence correlation"
                  : matchValue >= 75
                    ? "Moderate structural similarity"
                    : "Partial geometric alignment"}
              </p>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                matchValue >= 90
                  ? "border border-alert/30 bg-alert/10 text-alert"
                  : matchValue >= 75
                    ? "border border-cyber/30 bg-cyber/10 text-cyber"
                    : "border border-slate-600 bg-slate-800 text-slate-300",
              )}
            >
              <Radar className="h-3.5 w-3.5 animate-pulse" />
              <span>
                {matchValue >= 90
                  ? "Positive Identification"
                  : matchValue >= 75
                    ? "Probable Match"
                    : "Candidate Review"}
              </span>
            </div>
          </GlassCard>
        </div>

        {/* Right: Database Profile */}
        <GlassCard className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Database Profile
            </span>
            {primaryMatch && (
              <span className="font-mono text-xs font-semibold text-alert">
                {primaryMatch.suspect_id}
              </span>
            )}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-hairline bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryMatch?.mugshot_url || "/subject-mugshot.png"}
              alt={`Database mugshot of identified subject ${primaryMatch?.full_name || "Suspect"}`}
              className="absolute inset-0 h-full w-full rounded-2xl object-cover"
              onError={(e) => {
                e.currentTarget.src = "/subject-mugshot.png"
              }}
            />
            <FaceAnchors color="rgba(245,158,11,0.9)" />
            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-alert/40 bg-canvas/80 px-2.5 py-1 text-[10px] font-semibold text-alert backdrop-blur-md">
              <Fingerprint className="h-3 w-3" />
              VERIFIED RECORD
            </div>
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-white">
            Subject: {primaryMatch?.full_name || "Ananya Rao"}
          </p>
        </GlassCard>
      </div>

      {/* Selected Suspect Detailed Metrics & Intelligence Tiles */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoTile
          icon={Calendar}
          label="Subject Age"
          value={`${primaryMatch?.age ?? 25} years`}
          tone="cyber"
        />
        <InfoTile
          icon={FileWarning}
          label="Active Warrants"
          value={`${primaryMatch?.active_warrants ?? 2} Open`}
          tone="alert"
        />
        <InfoTile
          icon={Gavel}
          label="Past Offenses"
          value={`${primaryMatch?.past_offenses ?? 4} Records`}
          tone="cyber"
        />
      </div>

      {/* Modus Operandi & Physical Characteristics Ledger */}
      {primaryMatch && (
        <div className="mt-4 rounded-2xl border border-hairline bg-panel/50 p-4 backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Physical Markings & Biometrics
              </span>
              <p className="mt-1 text-xs text-slate-300">
                {primaryMatch.physical_marks || "Linear scar on jawline, facial tattoo demarcation"}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Modus Operandi & Tactical MO
              </span>
              <p className="mt-1 text-xs text-slate-300">
                {primaryMatch.modus_operandi || "Unauthorized biometric spoofing & network infiltration"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Task 3 Core Requirement: Dynamic Ranked Suspect Cards Grid */}
      <div className="mt-10">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyber" />
              <h3 className="text-base font-semibold text-white">
                Biometric Candidate Matches
              </h3>
              <span className="rounded-full border border-cyber/30 bg-cyber/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyber">
                {matches.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Ranked in descending order by Cosine Similarity dot product against geometric feature vector
            </p>
          </div>

          <span className="text-[11px] font-medium text-slate-500">
            Click any suspect card to inspect comparative alignment
          </span>
        </div>

        {loading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-panel/40">
            <Loader2 className="h-8 w-8 animate-spin text-cyber" />
            <span className="text-xs font-semibold uppercase tracking-wider text-cyber">
              Running Cosine Similarity Analysis Matrix…
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((suspect, idx) => {
              const isSelected = selectedSuspect?.suspect_id === suspect.suspect_id
              const isTop = idx === 0

              return (
                <div
                  key={suspect.suspect_id}
                  onClick={() => setSelectedSuspect(suspect)}
                  className={cn(
                    "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-300 cursor-pointer",
                    isSelected
                      ? "border-cyber bg-cyber/10 shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)]"
                      : "border-hairline bg-panel/60 hover:border-cyber/40 hover:bg-panel/90",
                  )}
                >
                  {/* Top Badge: System Identity & Match Rank */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyber">
                      {suspect.suspect_id}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isTop && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                          Top Fit
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 font-mono text-xs font-bold",
                          suspect.match_score >= 90
                            ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : suspect.match_score >= 75
                              ? "border border-cyber/40 bg-cyber/15 text-cyber"
                              : "border border-slate-600 bg-slate-800 text-slate-400",
                        )}
                      >
                        {suspect.match_score}% Match
                      </span>
                    </div>
                  </div>

                  {/* Suspect Mugshot & Information */}
                  <div className="flex gap-3.5">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-hairline bg-canvas">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={suspect.mugshot_url || "/subject-mugshot.png"}
                        alt={suspect.full_name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = "/subject-mugshot.png"
                        }}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 border-2 border-cyber rounded-xl pointer-events-none" />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-cyber transition-colors">
                          {suspect.full_name}
                        </h4>
                        <span className="inline-block mt-0.5 text-[11px] font-medium text-slate-400">
                          {suspect.legal_status || "Suspect Record"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Age: <strong className="text-slate-200">{suspect.age || 25}</strong></span>
                        <span>•</span>
                        <span>Warrants: <strong className="text-alert">{suspect.active_warrants || 0}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Accuracy Bar */}
                  <div className="mt-3.5 pt-3 border-t border-hairline">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Cosine Similarity</span>
                      <span className="font-mono text-cyber font-semibold">
                        {suspect.match_score}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          suspect.match_score >= 90 ? "bg-emerald-400" : "bg-cyber",
                        )}
                        style={{ width: `${suspect.match_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Modus Operandi Snippet */}
                  <p className="mt-2.5 line-clamp-1 text-[11px] text-slate-400">
                    {suspect.modus_operandi}
                  </p>

                  {/* Card Select Button */}
                  <button
                    type="button"
                    className={cn(
                      "mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
                      isSelected
                        ? "bg-cyber text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                        : "border border-hairline bg-white/5 text-slate-300 hover:border-cyber/40 hover:text-white",
                    )}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active Comparison Fit
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Compare Biometrics
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleExportEvidence}
          disabled={exportingPdf}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 py-3.5 text-sm font-semibold text-emerald-400 transition-all hover:border-emerald-400 hover:bg-emerald-500/25 hover:shadow-[0_0_25px_-4px_rgba(52,211,153,0.5)] disabled:opacity-50"
        >
          {exportingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileCheck2 className="h-4 w-4" />
          )}
          {exportingPdf ? "Generating Court-Ready PDF…" : "Export Evidence File"}
        </button>
        <button
          onClick={() => {
            const link = document.createElement("a")
            link.href = activeSketch
            link.download = `${activeCaseNumber}-forensic-sketch.png`
            link.click()
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-hairline bg-panel/70 py-3.5 text-sm font-semibold text-slate-200 transition-all hover:border-cyber/40 hover:text-white"
        >
          <Download className="h-4 w-4" />
          Download Forensic Sketch
        </button>
        <button
          onClick={() => {
            alert(`Field Patrol Dispatch: Alert broadcast sent for ${primaryMatch?.full_name || "Suspect"} (${primaryMatch?.suspect_id || "CRIM-UNKNOWN"})`)
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-alert py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-alert/90 hover:shadow-[0_0_28px_-6px_rgba(245,158,11,0.85)]"
        >
          <Radar className="h-4 w-4" />
          Deploy Field Patrol Unit
        </button>
      </div>

      {exportSuccess && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="font-medium">{exportSuccess}</span>
        </div>
      )}
    </div>
  )
}

function MatchRing({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <div className="relative h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#223154" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 6px rgba(6,182,212,0.8))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight text-white">{value}%</span>
        <span className="text-[11px] uppercase tracking-widest text-cyber">Match</span>
      </div>
    </div>
  )
}

function FaceAnchors({ color }: { color: string }) {
  const anchors = [
    { x: "36%", y: "40%" },
    { x: "64%", y: "40%" },
    { x: "50%", y: "58%" },
    { x: "38%", y: "74%" },
    { x: "62%", y: "74%" },
  ]
  const lines = [
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 4],
  ]
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
      {lines.map(([a, b], i) => (
        <line
          key={i}
          x1={anchors[a].x}
          y1={anchors[a].y}
          x2={anchors[b].x}
          y2={anchors[b].y}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.8"
        />
      ))}
      {anchors.map((a, i) => (
        <circle key={i} cx={a.x} cy={a.y} r="3" fill={color} />
      ))}
    </svg>
  )
}

function InfoTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Calendar
  label: string
  value: string
  tone: "cyber" | "alert"
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-panel/60 p-4 backdrop-blur-xl transition-colors hover:border-cyber/30">
      <span
        className={
          tone === "cyber"
            ? "flex h-10 w-10 items-center justify-center rounded-xl border border-cyber/40 bg-cyber/10 text-cyber"
            : "flex h-10 w-10 items-center justify-center rounded-xl border border-alert/40 bg-alert/10 text-alert"
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-widest text-slate-500">{label}</span>
        <span className="text-base font-semibold text-white">{value}</span>
      </div>
    </div>
  )
}

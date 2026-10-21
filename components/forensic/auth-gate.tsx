"use client"

import { useState } from "react"
import { BadgeCheck, KeyRound, Fingerprint, ShieldCheck, Loader2 } from "lucide-react"
import { StatusCapsule } from "./primitives"
import { cn } from "@/lib/utils"

export function AuthGate({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const [badge, setBadge] = useState("")
  const [node, setNode] = useState("")
  const [scanning, setScanning] = useState(false)
  const [done, setDone] = useState(false)

  function handleScan() {
    if (scanning || done) return
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      setDone(true)
      onAuthenticated?.()
    }, 2200)
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 py-10 lg:min-h-screen">
      <div className="w-full max-w-md animate-fade-up rounded-[24px] border border-cyber/25 bg-panel/60 p-8 shadow-[0_0_60px_-20px_rgba(6,182,212,0.45)] backdrop-blur-xl">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyber/40 bg-cyber/10 shadow-[0_0_30px_-8px_rgba(6,182,212,0.7)]">
            <ShieldCheck className="h-7 w-7 text-cyber" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Secure Auth Gate</h1>
          <p className="mt-1 text-sm text-slate-400">
            Verify your credentials to access the forensic command suite.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Field
            label="Officer Badge ID"
            icon={BadgeCheck}
            value={badge}
            onChange={setBadge}
            placeholder="e.g. PD-48821"
          />
          <Field
            label="Department Node Code"
            icon={KeyRound}
            value={node}
            onChange={setNode}
            placeholder="e.g. NODE-CENTRAL-07"
          />

          <button
            onClick={handleScan}
            disabled={done}
            className={cn(
              "group relative mt-2 flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-6 py-3.5 text-sm font-semibold transition-all duration-300",
              done
                ? "bg-emerald-500 text-slate-900"
                : "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/25",
            )}
          >
            {!done && (
              <span
                className={cn(
                  "absolute inset-0 rounded-full bg-emerald-400/20",
                  scanning ? "animate-ping" : "opacity-0",
                )}
              />
            )}
            {scanning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Fingerprint className={cn("h-5 w-5", !done && "animate-pulse")} />
            )}
            <span className="relative">
              {done ? "Biometric Verified" : scanning ? "Scanning Fingerprint…" : "Authenticate Biometric"}
            </span>
          </button>
        </div>

        <div className="mt-7 flex justify-center">
          <StatusCapsule label="AI Core System: Secure & Operational" />
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  label: string
  icon: typeof BadgeCheck
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-canvas/60 px-3.5 py-3 transition-colors focus-within:border-cyber/50">
        <Icon className="h-[18px] w-[18px] shrink-0 text-slate-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
        />
      </div>
    </label>
  )
}

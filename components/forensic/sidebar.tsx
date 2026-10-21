"use client"

import { cn } from "@/lib/utils"
import { Fingerprint, ScanFace, Users, ShieldCheck, Menu, X } from "lucide-react"
import { useState } from "react"

export type PageId = "auth" | "interview" | "match"

const NAV: { id: PageId; label: string; sub: string; icon: typeof Fingerprint }[] = [
  { id: "auth", label: "Secure Auth Gate", sub: "Identity verification", icon: Fingerprint },
  { id: "interview", label: "Live Interview Canvas", sub: "Portrait workspace", icon: ScanFace },
  { id: "match", label: "Biometric Record Match", sub: "Intelligence screen", icon: Users },
]

export function Sidebar({
  active,
  onChange,
}: {
  active: PageId
  onChange: (id: PageId) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-hairline bg-panel/60 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-hairline p-2 text-slate-300 transition-colors hover:text-cyber"
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "z-30 w-72 shrink-0 flex-col gap-6 border-r border-hairline bg-panel/40 p-5 backdrop-blur-xl",
          "lg:flex lg:h-screen lg:sticky lg:top-0",
          open ? "flex" : "hidden",
        )}
      >
        <div className="hidden lg:block">
          <Brand />
        </div>

        <nav className="flex flex-col gap-2">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Command Modules
          </p>
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChange(item.id)
                  setOpen(false)
                }}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                  isActive
                    ? "border-cyber/40 bg-cyber/10 shadow-[0_0_25px_-8px_rgba(6,182,212,0.6)]"
                    : "border-transparent hover:border-hairline hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    isActive
                      ? "border-cyber/50 bg-cyber/15 text-cyber"
                      : "border-hairline bg-canvas/60 text-slate-400 group-hover:text-slate-200",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex flex-col">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isActive ? "text-white" : "text-slate-300",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{item.sub}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-hairline bg-canvas/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <ShieldCheck className="h-4 w-4 text-cyber" />
            Clearance Level 4
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Encrypted forensic session. All actions are logged to the evidence ledger.
          </p>
        </div>
      </aside>
    </>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyber/40 bg-cyber/10 shadow-[0_0_20px_-6px_rgba(6,182,212,0.7)]">
        <ScanFace className="h-5 w-5 text-cyber" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight text-white">ForensAI Suite</span>
        <span className="text-[11px] text-slate-500">Suspect Portrait System</span>
      </div>
    </div>
  )
}

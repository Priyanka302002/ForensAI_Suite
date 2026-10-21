"use client"

import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export function GlassCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-hairline bg-panel/60 p-6 backdrop-blur-xl",
        "shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] transition-all duration-300",
        "hover:border-cyber/30 hover:shadow-[0_25px_70px_-25px_rgba(6,182,212,0.25)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatusCapsule({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>
      <span className="text-xs font-medium text-emerald-300">{label}</span>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyber">
        {eyebrow}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-white text-balance">{title}</h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-400 text-pretty">{description}</p>
    </div>
  )
}

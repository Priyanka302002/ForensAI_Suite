"use client"

import { useState } from "react"
import { Sidebar, type PageId } from "@/components/forensic/sidebar"
import { AuthGate } from "@/components/forensic/auth-gate"
import { InterviewCanvas } from "@/components/forensic/interview-canvas"
import { RecordMatch } from "@/components/forensic/record-match"

export default function Page() {
  const [page, setPage] = useState<PageId>("auth")

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-slate-200 lg:flex-row">
      <Sidebar active={page} onChange={setPage} />
      <main className="flex-1 overflow-x-hidden">
        {page === "auth" && <AuthGate onAuthenticated={() => setPage("interview")} />}
        {page !== "auth" && (
          <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
            {page === "interview" && <InterviewCanvas />}
            {page === "match" && <RecordMatch />}
          </div>
        )}
      </main>
    </div>
  )
}

// src/components/ui/AgentReportCard.jsx
//
// Drop this component into your Dashboard.jsx to show the AI agent's
// latest workflow status, code validation, prior auth, and readiness results.
//
// Usage:
//   import AgentReportCard from "../components/ui/AgentReportCard"
//   <AgentReportCard />

import { useEffect, useState } from "react"
import axios from "axios"

const API = "http://localhost:8000"
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` })

const statusColor = {
  APPROVED:        "bg-green-100 text-green-800 border-green-200",
  REQUIRES_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  DEFER:           "bg-red-100 text-red-800 border-red-200",
}

const verdictColor = {
  READY:       "text-green-700",
  CONDITIONAL: "text-amber-700",
  NOT_READY:   "text-red-700",
  INCOMPLETE:  "text-gray-500",
}

const authStatusColor = {
  AUTO_APPROVED:          "text-green-700",
  PRIOR_AUTH_REQUIRED:    "text-amber-700",
  UNKNOWN_PROCEDURE:      "text-red-700",
}

export default function AgentReportCard() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/intake-report`, { headers: authHeader() })
      .then(r => setReport(r.data.status === "no_report" ? null : r.data))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="rounded-2xl border border-[#3E435D]/15 bg-white/90 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-gray-100 rounded w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  )

  if (!report) return (
    <div className="rounded-2xl border border-dashed border-[#3E435D]/20 bg-white/60 p-6 text-center">
      <p className="text-sm text-[#9AA7B1]">No intake report yet.</p>
      <a href="/intake" className="mt-2 inline-block text-sm font-semibold text-[#3E435D] underline underline-offset-2">
        Complete your intake →
      </a>
    </div>
  )

  const codeStep  = report.audit_trail?.find(s => s.step === "code_validation")?.result
  const authStep  = report.audit_trail?.find(s => s.step === "prior_authorization")?.result
  const readyStep = report.audit_trail?.find(s => s.step === "readiness_evaluation")?.result

  return (
    <div className="rounded-2xl border border-[#3E435D]/15 bg-white/90 shadow-md p-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9AA7B1] mb-1">AI agent report</p>
          <p className="text-lg font-bold text-[#3E435D]">{report.patient_name}</p>
          <p className="text-sm text-[#3E435D]/70">{report.surgery_type} · {report.surgery_phase === "pre" ? "Pre-op" : "Post-op"}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusColor[report.workflow_status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
          {report.workflow_status?.replace("_", " ")}
        </span>
      </div>

      {/* Guardrails */}
      {report.guardrails?.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Guardrails triggered</p>
          <ul className="space-y-1">
            {report.guardrails.map((g, i) => (
              <li key={i} className="text-xs text-amber-800 flex gap-2">
                <span>⚠</span><span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Three summary pills */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Code validation */}
        <div className="rounded-xl bg-[#f8f7f4] border border-[#3E435D]/10 p-3">
          <p className="text-xs text-[#9AA7B1] mb-1">ICD-10</p>
          <p className="text-sm font-bold text-[#3E435D]">{codeStep?.icd10?.code || "—"}</p>
          <p className={`text-xs mt-0.5 ${codeStep?.icd10?.valid ? "text-green-600" : "text-red-500"}`}>
            {codeStep?.icd10?.valid ? "Valid" : "Unknown"}
          </p>
        </div>
        <div className="rounded-xl bg-[#f8f7f4] border border-[#3E435D]/10 p-3">
          <p className="text-xs text-[#9AA7B1] mb-1">CPT</p>
          <p className="text-sm font-bold text-[#3E435D]">{codeStep?.cpt?.code || "—"}</p>
          <p className={`text-xs mt-0.5 ${codeStep?.cpt?.valid ? "text-green-600" : "text-red-500"}`}>
            {codeStep?.cpt?.valid ? "Valid" : "Unknown"}
          </p>
        </div>
        <div className="rounded-xl bg-[#f8f7f4] border border-[#3E435D]/10 p-3">
          <p className="text-xs text-[#9AA7B1] mb-1">Readiness</p>
          <p className={`text-sm font-bold ${verdictColor[readyStep?.verdict] || "text-[#3E435D]"}`}>
            {readyStep?.verdict || "—"}
          </p>
          <p className="text-xs text-[#9AA7B1] mt-0.5 truncate">{authStep?.status?.replace("_", " ") || ""}</p>
        </div>
      </div>

      {/* Wound analysis */}
      {report.wound_analysis && (
        <div className="mb-4 rounded-xl bg-[#f0f9f4] border border-green-200 p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">Wound analysis</p>
          <p className="text-xs text-[#3E435D] line-clamp-3">{report.wound_analysis}</p>
        </div>
      )}

      {/* Expandable audit trail */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-xs font-semibold text-[#9AA7B1] hover:text-[#3E435D] transition text-left"
      >
        {expanded ? "▲ Hide audit trail" : "▼ Show full audit trail"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {report.audit_trail?.map((step, i) => (
            <div key={i} className="rounded-xl border border-[#3E435D]/10 p-3 bg-[#fafaf8]">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#9AA7B1] mb-1">
                Step {i + 1}: {step.step.replace(/_/g, " ")}
              </p>
              <pre className="text-xs text-[#3E435D] whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(step.result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

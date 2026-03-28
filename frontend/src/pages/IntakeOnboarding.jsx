import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

const API = "http://localhost:8000"
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` })

const EMPTY_FORM = {
  patient_name: "", age: "", gender: "", surgery_type: "",
  surgery_phase: "post", surgery_date: "", icd10_code: "", cpt_code: "",
  payer_id: "", bp_sys: "", bp_dia: "", heart_rate: "", spo2: "",
  temperature: "", hemoglobin: "", blood_sugar: "", notes: "",
  next_appointment_date: "",
}

export default function IntakeOnboarding() {
  const navigate = useNavigate()

  // ── pre-fill state ────────────────────────────────────────────────────────
  const [loadingPrefill, setLoadingPrefill] = useState(true)
  const [prefillSource, setPrefillSource]   = useState(null)
  const [lastUpdated, setLastUpdated]       = useState(null)
  const [isReturning, setIsReturning]       = useState(false)
  const [savedWoundAnalysis, setSavedWoundAnalysis] = useState("")

  // ── form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM)
  const [missingFields, setMissingFields] = useState([])
  const [dirtyFields, setDirtyFields] = useState(new Set())
  const [medications, setMedications] = useState([]) 

  // ── PDF extraction ────────────────────────────────────────────────────────
  const [pdfFile, setPdfFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractDone, setExtractDone] = useState(false)
  const [extractError, setExtractError] = useState("")

  // ── wound state ───────────────────────────────────────────────────────────
  const [offerWound, setOfferWound] = useState(false)
  const [woundFile, setWoundFile] = useState(null)
  const [woundPreview, setWoundPreview] = useState(null)
  const [woundAnalysis, setWoundAnalysis] = useState("")
  const [analyzingWound, setAnalyzingWound] = useState(false)

  // ── submission ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState("upload")

  const pdfRef = useRef()
  const woundRef = useRef()

  useEffect(() => {
    axios.get(`${API}/api/my-intake`, { headers: authHeader() })
      .then(res => {
        const { status, data, source, last_updated, wound_analysis } = res.data
        if (status === "prefilled" && data) {
          setForm(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "")
            ),
          }))
          setPrefillSource(source)
          setLastUpdated(last_updated)
          setIsReturning(true)
          if (wound_analysis) setSavedWoundAnalysis(wound_analysis)
          if (data.surgery_phase === "post") setOfferWound(true)
          setStep("form")
        }
      })
      .catch(() => { })
      .finally(() => setLoadingPrefill(false))
  }, [])

  // ── helpers ───────────────────────────────────────────────────────────────
  const setField = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setMissingFields(prev => prev.filter(f => f !== k))
    setDirtyFields(prev => new Set(prev).add(k))
    if (k === "surgery_phase") setOfferWound(v === "post")
  }

  // ── PDF extraction (UPGRADED) ─────────────────────────────────────────────
  const handlePdfChange = e => { if (e.target.files[0]) setPdfFile(e.target.files[0]) }

  const extractFromPdf = async () => {
    if (!pdfFile) return
    setExtracting(true); setExtractError("")
    try {
      const fd = new FormData()
      fd.append("file", pdfFile)

      const res = await axios.post(`${API}/api/scan`, fd, {
        headers: { ...authHeader(), "Content-Type": "multipart/form-data" },
      })

      const d = res.data?.data || res.data || {}
      const merged = {
        patient_name: d.patient_name || d.name || "",
        age: (d.age != null) ? String(d.age) : "",
        gender: d.gender || d.sex || "",
        surgery_type: d.surgery_type || d.procedure || "",
        surgery_phase: d.surgery_phase || d.phase || "post",
        surgery_date: d.surgery_date || d.date_of_surgery || "",
        icd10_code: d.icd10_code || d.icd_code || "",
        cpt_code: d.cpt_code || "",
        payer_id: form.payer_id,
        bp_sys: (d.bp_sys != null) ? String(d.bp_sys) : "",
        bp_dia: (d.bp_dia != null) ? String(d.bp_dia) : "",
        heart_rate: (d.heart_rate ?? d.pulse) != null ? String(d.heart_rate ?? d.pulse) : "",
        spo2: (d.spo2 ?? d.oxygen_saturation) != null ? String(d.spo2 ?? d.oxygen_saturation) : "",
        temperature: (d.temperature ?? d.temp) != null ? String(d.temperature ?? d.temp) : "",
        hemoglobin: (d.hemoglobin ?? d.hb) != null ? String(d.hemoglobin ?? d.hb) : "",
        blood_sugar: (d.blood_sugar ?? d.glucose) != null ? String(d.blood_sugar ?? d.glucose) : "",
        notes: d.notes || d.pre_op_restrictions || "",
      }

      setForm(merged)
      setMedications(d.medication_list || d.medications || []) 

      const req = ["patient_name", "age", "gender", "surgery_type", "surgery_date", "icd10_code", "cpt_code"]
      setMissingFields(req.filter(k => !merged[k]))
      if (merged.surgery_phase === "post") setOfferWound(true)

      setExtractDone(true); setStep("form")
      setIsReturning(false) 
    } catch {
      setExtractError("Could not extract data — please fill the form manually.")
      setExtractDone(true); setStep("form")
    } finally {
      setExtracting(false)
    }
  }

  // ── wound image ───────────────────────────────────────────────────────────
  const handleWoundChange = e => {
    const f = e.target.files[0]
    if (!f) return
    setWoundFile(f)
    setWoundPreview(URL.createObjectURL(f))
    setWoundAnalysis("")
  }

  const analyzeWound = async () => {
    if (!woundFile) return
    setAnalyzingWound(true)
    try {
      const fd = new FormData()
      fd.append("file", woundFile)
      const res = await axios.post(`${API}/api/analyze-wound`, fd, {
        headers: { ...authHeader(), "Content-Type": "multipart/form-data" },
      })
      setWoundAnalysis(res.data.analysis || "")
    } catch {
      setWoundAnalysis("Wound analysis failed. You can continue anyway.")
    } finally {
      setAnalyzingWound(false)
    }
  }

  // ── validation ────────────────────────────────────────────────────────────
  const required = ["patient_name", "age", "gender", "surgery_type", "surgery_date", "icd10_code", "cpt_code"]

  const validate = () => {
    const missing = required.filter(k => !form[k]?.trim())
    setMissingFields(missing)
    if (missing.length > 0) {
      alert("Please fill in the highlighted fields before continuing.")
      return false
    }
    return true
  }

  const saveUpdates = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      await axios.patch(`${API}/api/update-intake`, {
        ...form,
        wound_analysis: woundAnalysis || savedWoundAnalysis,
      }, { headers: authHeader() })
      navigate("/dashboard")
    } catch {
      alert("Could not save updates. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const fullSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      // Step 1: Update Profile with core details
      await axios.post(`${API}/api/create-profile`, {
        patient_name: form.patient_name,
        surgery_type: form.surgery_type,
        surgery_date: form.surgery_date
      }, { headers: authHeader() })

      // Step 2: Submit the rest of the form
      await axios.post(`${API}/api/submit-intake`, {
        ...form,
        wound_analysis: woundAnalysis,
      }, { headers: authHeader() })
      navigate("/dashboard")
    } catch {
      alert("Submission failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── UI primitives ─────────────────────────────────────────────────────────
  const inp = (k, placeholder, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[k]}
      onChange={e => setField(k, e.target.value)}
      className={`w-full rounded-xl border px-4 py-3 text-[#3E435D] placeholder:text-[#9AA7B1] outline-none transition focus:ring-2 focus:ring-[#9AA7B1]/40 ${missingFields.includes(k)
          ? "border-red-400 bg-red-50"
          : dirtyFields.has(k) && isReturning
            ? "border-[#3E435D]/40 bg-[#f5f4f0]"
            : "border-[#3E435D]/20 bg-white"
        }`}
    />
  )

  const lbl = (text, req = false) => (
    <label className="block text-sm font-medium text-[#3E435D]/80 mb-1">
      {text}{req && <span className="text-red-400 ml-1">*</span>}
    </label>
  )

  const sec = text => (
    <p className="text-xs font-semibold uppercase tracking-widest text-[#9AA7B1] mb-3 mt-6">{text}</p>
  )

  if (loadingPrefill) return (
    <div className="min-h-screen bg-gradient-to-br from-[#D3D0BC] to-[#CBC3A5] flex items-center justify-center">
      <div className="rounded-2xl bg-white/90 p-10 shadow-xl text-center">
        <div className="w-8 h-8 border-2 border-[#3E435D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#9AA7B1]">Loading your saved details…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#D3D0BC] via-[#D3D0BC] to-[#CBC3A5] px-4 py-10 pb-20">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-medium tracking-wide text-[#9AA7B1]">SurgiSense AI Agent</p>
          <h1 className="text-3xl font-bold text-[#3E435D] mt-1">
            {isReturning ? "Your intake details" : "Patient intake"}
          </h1>
          <p className="text-sm text-[#3E435D]/70 mt-1">
            {isReturning
              ? "Your details from your last session are pre-filled. Edit anything that has changed, then save."
              : "Upload your prescription or discharge summary — we'll extract your details automatically."}
          </p>
        </div>

        {isReturning && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 mb-6 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">Details pre-filled from your last session</p>
              {lastUpdated && (
                <p className="text-xs text-green-700 mt-0.5">
                  Last saved: {new Date(lastUpdated).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {prefillSource === "patient_profile" ? " (from profile setup)" : ""}
                </p>
              )}
            </div>
            <button
              onClick={() => { setIsReturning(false); setStep("upload"); setExtractDone(false) }}
              className="text-xs text-green-700 hover:text-green-900 transition whitespace-nowrap shrink-0 font-medium"
            >
              Upload new PDF →
            </button>
          </div>
        )}

        {/* ── PDF upload ────────────────────────────────────────────────── */}
        {!isReturning && (
          <div className="rounded-2xl border border-[#3E435D]/15 bg-white/90 shadow-xl backdrop-blur-sm p-8 mb-6">
            <p className="text-base font-semibold text-[#3E435D] mb-3">1 — Upload your medical document</p>
            <div
              onClick={() => pdfRef.current.click()}
              className="border-2 border-dashed border-[#9AA7B1]/50 rounded-xl p-8 text-center cursor-pointer hover:border-[#3E435D]/40 transition"
            >
              {pdfFile
                ? <p className="text-[#3E435D] font-medium">{pdfFile.name}</p>
                : <p className="text-[#9AA7B1]">Click to upload PDF (prescription / discharge summary)</p>
              }
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
            </div>
            {extractError && <p className="mt-2 text-sm text-red-500">{extractError}</p>}
            <button
              onClick={extractFromPdf}
              disabled={!pdfFile || extracting}
              className="mt-4 w-full rounded-xl bg-[#3E435D] px-4 py-3 font-semibold text-[#D3D0BC] transition hover:bg-[#34394F] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {extracting ? "Extracting data…" : extractDone ? "Re-extract" : "Extract & auto-fill form"}
            </button>
            {extractDone && missingFields.length > 0 && (
              <p className="mt-3 text-sm text-amber-600">
                {missingFields.length} field{missingFields.length > 1 ? "s" : ""} could not be extracted — please fill them in below.
              </p>
            )}
            {!extractDone && (
              <button
                onClick={() => setStep("form")}
                className="mt-3 w-full text-xs text-[#9AA7B1] hover:text-[#3E435D] transition"
              >
                Skip PDF and fill manually →
              </button>
            )}
          </div>
        )}

        {/* ── Intake form ───────────────────────────────────────────────── */}
        {step === "form" && (
          <div className="rounded-2xl border border-[#3E435D]/15 bg-white/90 shadow-xl backdrop-blur-sm p-8 mb-6">
            <p className="text-base font-semibold text-[#3E435D] mb-1">
              {isReturning ? "Your details" : "2 — Review and complete intake form"}
            </p>
            {missingFields.length > 0 && (
              <p className="text-xs text-red-500 mb-4">Required fields are highlighted — please fill them before saving.</p>
            )}
            {isReturning && dirtyFields.size > 0 && (
              <p className="text-xs text-[#9AA7B1] mb-4">Edited fields are lightly highlighted.</p>
            )}

            {sec("Patient information")}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">{lbl("Full name", true)}{inp("patient_name", "e.g. Rohit Sharma")}</div>
              <div>{lbl("Age", true)}{inp("age", "e.g. 42", "number")}</div>
              <div>
                {lbl("Gender", true)}
                <select
                  value={form.gender}
                  onChange={e => setField("gender", e.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-[#3E435D] outline-none transition focus:ring-2 focus:ring-[#9AA7B1]/40 ${missingFields.includes("gender") ? "border-red-400 bg-red-50" : "border-[#3E435D]/20 bg-white"
                    }`}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {sec("Surgery details")}
            <div className="grid grid-cols-2 gap-3">
              <div>{lbl("Surgery type", true)}{inp("surgery_type", "e.g. Appendectomy")}</div>
              <div>
                {lbl("Phase", true)}
                <select
                  value={form.surgery_phase}
                  onChange={e => setField("surgery_phase", e.target.value)}
                  className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] outline-none transition focus:ring-2 focus:ring-[#9AA7B1]/40"
                >
                  <option value="pre">Pre-operative</option>
                  <option value="post">Post-operative</option>
                </select>
              </div>
              <div>{lbl("Surgery date", true)}{inp("surgery_date","","date")}</div>
              {form.surgery_phase === "post" && (
                <div>{lbl("Next appointment date")}{inp("next_appointment_date","","date")}</div>
              )}
              <div>{lbl("Payer / Insurance ID")}{inp("payer_id","e.g. PAYER-001")}</div>
            </div>

            {sec("Clinical codes (ICD-10 / CPT)")}
            <div className="grid grid-cols-2 gap-3">
              <div>
                {lbl("ICD-10 code", true)}
                {inp("icd10_code", "e.g. K35.89")}
                <p className="text-xs text-[#9AA7B1] mt-1">International Classification of Diseases</p>
              </div>
              <div>
                {lbl("CPT code", true)}
                {inp("cpt_code", "e.g. 44950")}
                <p className="text-xs text-[#9AA7B1] mt-1">Current Procedural Terminology</p>
              </div>
            </div>

            {sec("Vitals (for surgery readiness evaluation)")}
            <div className="grid grid-cols-3 gap-3">
              <div>{lbl("BP Systolic")}{inp("bp_sys", "mmHg", "number")}</div>
              <div>{lbl("BP Diastolic")}{inp("bp_dia", "mmHg", "number")}</div>
              <div>{lbl("Heart rate")}{inp("heart_rate", "bpm", "number")}</div>
              <div>{lbl("SpO₂")}{inp("spo2", "% sat", "number")}</div>
              <div>{lbl("Temperature")}{inp("temperature", "°C", "number")}</div>
              <div>{lbl("Hemoglobin")}{inp("hemoglobin", "g/dL", "number")}</div>
              <div className="col-span-3">{lbl("Blood sugar")}{inp("blood_sugar", "mg/dL", "number")}</div>
            </div>

            {sec("Additional notes")}
            <textarea
              placeholder="Any additional clinical notes, allergies, or instructions…"
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#3E435D]/20 bg-white px-4 py-3 text-[#3E435D] placeholder:text-[#9AA7B1] outline-none transition focus:border-[#3E435D] focus:ring-2 focus:ring-[#9AA7B1]/40 resize-none"
            />

            {medications.length > 0 && (
              <>
                {sec("Extracted Medications")}
                <div className="bg-[#f8f7f4] rounded-xl border border-[#3E435D]/10 p-4 space-y-2">
                  {medications.map((m, i) => (
                    <div key={i} className="text-sm font-medium text-[#3E435D] border-b border-[#3E435D]/10 pb-2 last:border-0 last:pb-0">
                      <span className="font-bold">{m.name || m}</span> {m.dosage ? `- ${m.dosage}` : ''} {m.frequency ? `(${m.frequency})` : ''}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[#9AA7B1] mt-2">
                  Extracted from your document and automatically saved to your Pharmacy.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Wound section (post-op only) ──────────────────────────────── */}
        {offerWound && step === "form" && (
          <div className="rounded-2xl border border-[#3E435D]/15 bg-white/90 shadow-xl backdrop-blur-sm p-8 mb-6">
            <p className="text-base font-semibold text-[#3E435D] mb-1">
              {isReturning ? "Wound analysis" : "3 — Wound analysis"}
              <span className="text-[#9AA7B1] font-normal text-sm ml-2">(optional, post-op only)</span>
            </p>

            {savedWoundAnalysis && !woundAnalysis && (
              <div className="mb-4 rounded-xl bg-[#f8f7f4] border border-[#3E435D]/10 p-4">
                <p className="text-xs font-semibold text-[#9AA7B1] uppercase tracking-widest mb-1">Previous analysis</p>
                <p className="text-sm text-[#3E435D] whitespace-pre-wrap">{savedWoundAnalysis}</p>
                <p className="text-xs text-[#9AA7B1] mt-2">Upload a new photo below to update this.</p>
              </div>
            )}

            {woundPreview && (
              <img src={woundPreview} alt="Wound preview"
                className="w-full max-h-52 object-cover rounded-xl mb-4 border border-[#3E435D]/10" />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => woundRef.current.click()}
                className="flex-1 rounded-xl border border-[#3E435D]/20 bg-[#CBC3A5] px-4 py-3 text-center font-semibold text-[#3E435D] transition hover:bg-[#c2b998]"
              >
                {woundFile ? "Change image" : savedWoundAnalysis ? "Upload new photo" : "Upload wound photo"}
              </button>
              {woundFile && !woundAnalysis && (
                <button
                  onClick={analyzeWound}
                  disabled={analyzingWound}
                  className="flex-1 rounded-xl bg-[#3E435D] px-4 py-3 font-semibold text-[#D3D0BC] transition hover:bg-[#34394F] disabled:opacity-60"
                >
                  {analyzingWound ? "Analyzing…" : "Analyze wound"}
                </button>
              )}
            </div>
            <input ref={woundRef} type="file" accept="image/*" className="hidden" onChange={handleWoundChange} />

            {woundAnalysis && (
              <div className="mt-4 rounded-xl bg-[#f0f9f4] border border-green-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-1">New analysis result</p>
                <p className="text-sm text-[#3E435D] whitespace-pre-wrap">{woundAnalysis}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────────── */}
        {step === "form" && (
          isReturning ? (
            <button
              onClick={saveUpdates}
              disabled={submitting}
              className="w-full rounded-xl bg-[#3E435D] px-4 py-4 font-semibold text-[#D3D0BC] transition hover:bg-[#34394F] disabled:opacity-60 disabled:cursor-not-allowed text-base"
            >
              {submitting
                ? "Saving…"
                : dirtyFields.size > 0
                  ? `Save ${dirtyFields.size} change${dirtyFields.size > 1 ? "s" : ""} →`
                  : "Continue to dashboard →"}
            </button>
          ) : (
            <button
              onClick={fullSubmit}
              disabled={submitting}
              className="w-full rounded-xl bg-[#3E435D] px-4 py-4 font-semibold text-[#D3D0BC] transition hover:bg-[#34394F] disabled:opacity-60 disabled:cursor-not-allowed text-base"
            >
              {submitting ? "Running AI agent workflow…" : "Submit & start analysis →"}
            </button>
          )
        )}
      </div>
    </div>
  )
}
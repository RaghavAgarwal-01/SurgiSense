import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  Heart, ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  ChevronRight, Loader2, Home, MessageCircle, Pill, Menu, X,
  RefreshCw, ClipboardList, Activity, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import surgiLogo from "../assets/surgisense-logo.jpeg";
import API_BASE from "../api";
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const verdictConfig = {
  READY: {
    icon: ShieldCheck,
    label: "Ready for Surgery",
    sub: "All evaluated criteria met. Patient appears clinically ready.",
    bg: "bg-emerald-50", border: "border-emerald-200",
    text: "text-emerald-700", iconBg: "bg-emerald-100", iconColor: "text-emerald-600",
    bar: "bg-emerald-400",
  },
  CONDITIONAL: {
    icon: AlertTriangle,
    label: "Conditional — Review Required",
    sub: "One criterion failed. Clinical review recommended before proceeding.",
    bg: "bg-amber-50", border: "border-amber-200",
    text: "text-amber-700", iconBg: "bg-amber-100", iconColor: "text-amber-600",
    bar: "bg-amber-400",
  },
  NOT_READY: {
    icon: XCircle,
    label: "Not Ready",
    sub: "Multiple criteria failed. Delay surgery until conditions are resolved.",
    bg: "bg-red-50", border: "border-red-200",
    text: "text-red-700", iconBg: "bg-red-100", iconColor: "text-red-600",
    bar: "bg-red-400",
  },
  INCOMPLETE: {
    icon: Info,
    label: "Incomplete Data",
    sub: "Vitals were not fully recorded during intake. Please update your intake form.",
    bg: "bg-[#D3D0BC]/30", border: "border-[#CBC3A5]",
    text: "text-[#3E435D]", iconBg: "bg-[#CBC3A5]/30", iconColor: "text-[#3E435D]",
    bar: "bg-[#9AA7B1]",
  },
};

const workflowBadge = {
  APPROVED:        { label: "Approved",        cls: "bg-emerald-100 text-emerald-700" },
  REQUIRES_REVIEW: { label: "Requires Review", cls: "bg-amber-100 text-amber-700" },
  DEFER:           { label: "Deferred",        cls: "bg-red-100 text-red-700" },
};

export default function SurgeryReadiness() {
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen]     = useState(false);
  const lastScrollYRef = useRef(0);
  const headerRef      = useRef(null);

  const [loading, setLoading]       = useState(true);
  const [report, setReport]         = useState(null);
  const [readiness, setReadiness]   = useState(null);
  const [codeResult, setCodeResult] = useState(null);
  const [authResult, setAuthResult] = useState(null);
  const [intake, setIntake]         = useState(null);
  const [error, setError]           = useState("");
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y < lastScrollYRef.current || y < 10) setIsNavVisible(true);
          else if (y > lastScrollYRef.current && y > 80) { setIsNavVisible(false); setIsMenuOpen(false); }
          lastScrollYRef.current = y;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const [reportRes, intakeRes] = await Promise.all([
        axios.get(`${API_BASE}/api/intake-report`, { headers: authHeader() }),
        axios.get(`${API_BASE}/api/my-intake`,     { headers: authHeader() }),
      ]);
      const r = reportRes.data;
      if (r.status === "no_report") {
        setError("No intake report found. Please complete the intake form first.");
        setLoading(false);
        return;
      }
      setReport(r);
      const trail = r.audit_trail || [];
      const codeStep = trail.find(s => s.step === "code_validation");
      const authStep = trail.find(s => s.step === "prior_authorization");
      const readStep = trail.find(s => s.step === "readiness_evaluation");
      if (codeStep) setCodeResult(codeStep.result);
      if (authStep) setAuthResult(authStep.result);
      if (readStep) setReadiness(readStep.result);
      if (intakeRes.data?.data) setIntake(intakeRes.data.data);
    } catch (e) {
      setError("Failed to load report. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const handleReEvaluate = async () => {
    setEvaluating(true);
    await loadReport();
    setEvaluating(false);
  };

  const cfg = readiness ? (verdictConfig[readiness.verdict] || verdictConfig.INCOMPLETE) : null;
  const passedCount = readiness?.criteria?.filter(c => c.passed).length || 0;
  const totalCount  = readiness?.criteria?.length || 0;

  return (
    <div className="min-h-screen bg-linear-to-b from-[#D3D0BC] to-[#D3D0BC]/90">
      <header ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 bg-[#3E435D]/95 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${isNavVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="max-w-7xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="w-11 h-11 hover:scale-105 transition-transform flex-shrink-0">
                <img src={surgiLogo} alt="SurgiSense" className="w-full h-full object-contain" style={{mixBlendMode:'screen', filter:'brightness(1.15) contrast(1.05)'}} />
              </Link>
              <div>
                <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">SurgiSense</h1>
                <p className="text-[#9AA7B1] text-xs">Surgery Readiness</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard"         className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Home</Link>
                <Link to="/chat"              className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Chat</Link>
                <Link to="/surgery-readiness" className="px-3 py-1.5 rounded-lg text-[#CBC3A5] text-sm font-medium bg-[#CBC3A5]/10">Readiness</Link>
                <Link to="/pharmacy"          className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Pharmacy</Link>
              </div>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-[#D3D0BC] hover:bg-white/10 p-2 rounded-lg transition-colors">
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed left-0 right-0 bg-[#3E435D]/95 backdrop-blur-md z-40 border-b border-white/5 md:hidden"
            style={{ top: headerRef.current ? headerRef.current.offsetHeight + "px" : "80px" }}>
            <div className="px-5 py-3 space-y-1">
              {[{ to: "/dashboard", icon: Home, label: "Dashboard" }, { to: "/chat", icon: MessageCircle, label: "AI Chat" },
                { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness" }, { to: "/pharmacy", icon: Pill, label: "Pharmacy" }
              ].map(item => (
                <Link key={item.to} to={item.to} onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <item.icon className="w-5 h-5 text-[#CBC3A5]" />
                  <span className="text-[#D3D0BC] text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto px-5 pt-24 pb-24 space-y-5">

        {/* Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#3E435D] rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#CBC3A5]" />
            </div>
            <div>
              <h2 className="text-[#3E435D] text-2xl font-bold tracking-tight">Surgery Readiness</h2>
              <p className="text-[#9AA7B1] text-sm">Based on your intake assessment</p>
            </div>
          </div>
          <button onClick={handleReEvaluate} disabled={evaluating || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 border border-[#3E435D]/10 text-[#3E435D] text-xs font-semibold hover:bg-white transition-all disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? "animate-spin" : ""}`} />
            {evaluating ? "Refreshing…" : "Refresh"}
          </button>
        </motion.div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-[#3E435D] animate-spin" />
            <p className="text-[#9AA7B1] text-sm">Loading your assessment…</p>
          </div>
        )}

        {!loading && error && (
          <motion.div initial="hidden" animate="visible" variants={fadeIn}
            className="bg-white/80 rounded-2xl p-8 border border-[#3E435D]/5 text-center space-y-4">
            <XCircle className="w-10 h-10 text-[#9AA7B1] mx-auto" />
            <p className="text-[#3E435D] font-semibold">{error}</p>
            <Link to="/intake" className="inline-flex items-center gap-2 bg-[#3E435D] text-[#D3D0BC] px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4a5070] transition-colors">
              <ClipboardList className="w-4 h-4" /> Go to Intake Form
            </Link>
          </motion.div>
        )}

        {!loading && !error && readiness && cfg && (
          <>
            {/* Verdict */}
            <motion.section initial="hidden" animate="visible" variants={fadeIn}
              className={`rounded-2xl p-6 border ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                  <cfg.icon className={`w-7 h-7 ${cfg.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`text-xl font-bold ${cfg.text}`}>{cfg.label}</h3>
                    {report?.workflow_status && workflowBadge[report.workflow_status] && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${workflowBadge[report.workflow_status].cls}`}>
                        {workflowBadge[report.workflow_status].label}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm leading-relaxed opacity-80 ${cfg.text}`}>{readiness.rationale || cfg.sub}</p>
                  {totalCount > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-medium mb-1.5">
                        <span className={cfg.text}>Criteria passed</span>
                        <span className={cfg.text}>{passedCount}/{totalCount}</span>
                      </div>
                      <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
                        <div className={`h-2 rounded-full transition-all duration-700 ${cfg.bar}`}
                          style={{ width: `${totalCount ? (passedCount / totalCount) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Criteria */}
            {readiness.criteria?.length > 0 && (
              <motion.section initial="hidden" animate="visible" variants={fadeIn}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
                <h3 className="text-[#3E435D] text-sm font-bold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Clinical Criteria
                </h3>
                <div className="space-y-2.5">
                  {readiness.criteria.map((c, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${c.passed ? "bg-emerald-50/60 border-emerald-100" : "bg-red-50/60 border-red-100"}`}>
                      {c.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[#3E435D] text-xs font-semibold">{c.criterion}</p>
                        <p className="text-[#9AA7B1] text-xs">{c.detail}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {c.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Code validation */}
            {codeResult && (
              <motion.section initial="hidden" animate="visible" variants={fadeIn}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
                <h3 className="text-[#3E435D] text-sm font-bold mb-4">ICD-10 & CPT Code Validation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-4 rounded-xl border ${codeResult.icd10?.valid ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9AA7B1] mb-1">ICD-10</p>
                    <p className="text-[#3E435D] font-bold text-sm">{codeResult.icd10?.code || "—"}</p>
                    <p className="text-[#9AA7B1] text-xs mt-0.5 leading-snug">{codeResult.icd10?.description || "Unknown code"}</p>
                    <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${codeResult.icd10?.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {codeResult.icd10?.valid ? "VALID" : "INVALID"}
                    </span>
                  </div>
                  <div className={`p-4 rounded-xl border ${codeResult.cpt?.valid ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9AA7B1] mb-1">CPT</p>
                    <p className="text-[#3E435D] font-bold text-sm">{codeResult.cpt?.code || "—"}</p>
                    <p className="text-[#9AA7B1] text-xs mt-0.5 leading-snug">{codeResult.cpt?.description || "Unknown code"}</p>
                    <span className={`mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${codeResult.cpt?.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {codeResult.cpt?.valid ? "VALID" : "INVALID"}
                    </span>
                  </div>
                </div>
                <div className={`mt-3 p-3 rounded-xl border flex items-center gap-2 ${codeResult.code_match ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
                  {codeResult.code_match ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                  <p className={`text-xs font-medium ${codeResult.code_match ? "text-emerald-700" : "text-amber-700"}`}>
                    {codeResult.code_match ? "ICD-10 and CPT codes are coherent for this procedure." : "ICD-10 / CPT coherence mismatch — flagged for clinical review."}
                  </p>
                </div>
              </motion.section>
            )}

            {/* Prior Auth */}
            {authResult && (
              <motion.section initial="hidden" animate="visible" variants={fadeIn}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
                <h3 className="text-[#3E435D] text-sm font-bold mb-3">Prior Authorization</h3>
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  authResult.status === "AUTO_APPROVED" ? "bg-emerald-50 border-emerald-100" :
                  authResult.status === "PRIOR_AUTH_REQUIRED" ? "bg-amber-50 border-amber-100" : "bg-[#D3D0BC]/20 border-[#CBC3A5]/40"
                }`}>
                  {authResult.status === "AUTO_APPROVED" ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className={`text-sm font-bold ${authResult.status === "AUTO_APPROVED" ? "text-emerald-700" : "text-amber-700"}`}>
                      {authResult.status?.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-[#9AA7B1] mt-0.5 leading-relaxed">{authResult.reason}</p>
                    {authResult.payer_id && <p className="text-xs text-[#9AA7B1] mt-1">Payer: <span className="font-medium text-[#3E435D]">{authResult.payer_id}</span></p>}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Guardrails */}
            {report?.guardrails?.length > 0 && (
              <motion.section initial="hidden" animate="visible" variants={fadeIn}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h3 className="text-amber-700 text-sm font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Guardrails Triggered
                </h3>
                <ul className="space-y-1.5">
                  {report.guardrails.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <span className="mt-0.5 shrink-0">•</span><span>{g}</span>
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}

            {/* Vitals snapshot */}
            {intake && (
              <motion.section initial="hidden" animate="visible" variants={fadeIn}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#3E435D] text-sm font-bold">Vitals Snapshot</h3>
                  <Link to="/intake" className="text-xs text-[#9AA7B1] hover:text-[#3E435D] transition-colors font-medium">Update intake →</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Systolic BP", val: intake.bp_sys, unit: "mmHg" },
                    { label: "Diastolic BP", val: intake.bp_dia, unit: "mmHg" },
                    { label: "Heart Rate",   val: intake.heart_rate, unit: "bpm" },
                    { label: "SpO₂",         val: intake.spo2, unit: "%" },
                    { label: "Temperature",  val: intake.temperature, unit: "°C" },
                    { label: "Hemoglobin",   val: intake.hemoglobin, unit: "g/dL" },
                    { label: "Blood Sugar",  val: intake.blood_sugar, unit: "mg/dL" },
                  ].filter(f => f.val).map((f, i) => (
                    <div key={i} className="bg-[#D3D0BC]/15 rounded-xl p-3">
                      <p className="text-[9px] text-[#9AA7B1] font-medium uppercase tracking-wide">{f.label}</p>
                      <p className="text-[#3E435D] font-bold text-sm mt-0.5">{f.val} <span className="text-[10px] font-normal text-[#9AA7B1]">{f.unit}</span></p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            <motion.p initial="hidden" animate="visible" variants={fadeIn}
              className="text-xs text-[#9AA7B1] italic text-center px-4 leading-relaxed">
              ⚕️ This evaluation uses your intake vitals and established clinical guidelines (ASA, WHO Surgical Safety Checklist, ACC/AHA).
              It does not replace a comprehensive pre-operative evaluation by a physician or anesthesiologist.
            </motion.p>
          </>
        )}

        <Link to="/dashboard" className="group block bg-[#3E435D] rounded-2xl p-5 shadow-lg shadow-[#3E435D]/10 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#CBC3A5] w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Home className="w-5 h-5 text-[#3E435D]" />
              </div>
              <div>
                <h3 className="text-[#D3D0BC] font-semibold">Back to Dashboard</h3>
                <p className="text-[#9AA7B1] text-sm">Return to your recovery overview</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D3D0BC] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#3E435D]/10 px-4 py-2.5 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          {[
            { to: "/dashboard", icon: Home, label: "Home", active: false },
            { to: "/chat", icon: MessageCircle, label: "Chat", active: false },
            { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness", active: true },
            { to: "/pharmacy", icon: Pill, label: "Meds", active: false },
          ].map(item => (
            <Link key={item.label} to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${item.active ? "text-[#3E435D]" : "text-[#9AA7B1] hover:text-[#3E435D]"}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

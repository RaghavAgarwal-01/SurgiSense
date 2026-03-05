import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  Heart,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Loader2,
  Home,
  MessageCircle,
  Activity,
  Pill,
  Menu,
  X,
  Thermometer,
  Droplets,
  HeartPulse,
  Wind,
  Beaker,
  Candy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const API_BASE = "http://localhost:8000";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const surgeryOptions = [
  { value: "appendectomy", label: "Appendectomy" },
  { value: "cataract", label: "Cataract Surgery" },
  { value: "cabg", label: "CABG (Heart Bypass)" },
];

const vitalFields = [
  { key: "bp_sys", label: "Systolic BP", unit: "mmHg", icon: HeartPulse, type: "number", placeholder: "120" },
  { key: "bp_dia", label: "Diastolic BP", unit: "mmHg", icon: HeartPulse, type: "number", placeholder: "80" },
  { key: "heart_rate", label: "Heart Rate", unit: "bpm", icon: Activity, type: "number", placeholder: "72" },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Wind, type: "number", placeholder: "98" },
  { key: "temperature", label: "Temperature", unit: "°C", icon: Thermometer, type: "number", step: "0.1", placeholder: "36.6" },
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", icon: Droplets, type: "number", step: "0.1", placeholder: "13.5" },
  { key: "blood_sugar", label: "Blood Sugar", unit: "mg/dL", icon: Candy, type: "number", placeholder: "110" },
];

const statusConfig = {
  READY: {
    icon: ShieldCheck,
    label: "Ready for Surgery",
    description: "All vitals are within acceptable range. The patient is cleared for the procedure.",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  "NOT READY": {
    icon: XCircle,
    label: "Not Ready",
    description: "One or more vitals are outside the safe range. Surgery should be postponed until conditions improve.",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
  },
  "HIGH RISK": {
    icon: AlertTriangle,
    label: "High Risk",
    description: "Vitals indicate elevated risk. Proceed with extreme caution and additional monitoring.",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  DELAY: {
    icon: AlertTriangle,
    label: "Delay Recommended",
    description: "Current vitals suggest the surgery should be delayed. Stabilize the patient first.",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  "UNKNOWN SURGERY": {
    icon: HelpCircle,
    label: "Unknown Surgery Type",
    description: "The selected surgery type is not in our evaluation rules. Please consult a physician.",
    bgColor: "bg-[#D3D0BC]/30",
    borderColor: "border-[#CBC3A5]",
    textColor: "text-[#3E435D]",
    iconBg: "bg-[#CBC3A5]/30",
    iconColor: "text-[#3E435D]",
  },
};

export default function SurgeryReadiness() {
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const headerRef = useRef(null);

  const [surgery, setSurgery] = useState("");
  const [vitals, setVitals] = useState({
    bp_sys: "",
    bp_dia: "",
    heart_rate: "",
    spo2: "",
    temperature: "",
    hemoglobin: "",
    blood_sugar: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY < lastScrollYRef.current || currentScrollY < 10) {
            setIsNavVisible(true);
          } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 80) {
            setIsNavVisible(false);
            setIsMenuOpen(false);
          }
          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleVitalChange = (key, value) => {
    setVitals((prev) => ({ ...prev, [key]: value }));
  };

  const allFieldsFilled = surgery && Object.values(vitals).every((v) => v !== "");

  const handleEvaluate = async () => {
    if (!allFieldsFilled) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const payload = {
        surgery,
        bp_sys: parseInt(vitals.bp_sys),
        bp_dia: parseInt(vitals.bp_dia),
        heart_rate: parseInt(vitals.heart_rate),
        spo2: parseInt(vitals.spo2),
        temperature: parseFloat(vitals.temperature),
        hemoglobin: parseFloat(vitals.hemoglobin),
        blood_sugar: parseInt(vitals.blood_sugar),
      };

      const res = await axios.post(`${API_BASE}/api/evaluate`, payload);
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Evaluation failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSurgery("");
    setVitals({
      bp_sys: "",
      bp_dia: "",
      heart_rate: "",
      spo2: "",
      temperature: "",
      hemoglobin: "",
      blood_sugar: "",
    });
    setResult(null);
    setError("");
  };

  const statusInfo = result ? statusConfig[result.status] || statusConfig["UNKNOWN SURGERY"] : null;

  return (
    <div className="min-h-screen bg-linear-to-b from-[#D3D0BC] to-[#D3D0BC]/90">
      {/* NAVBAR */}
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 bg-[#3E435D]/95 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${
          isNavVisible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="w-9 h-9 bg-[#CBC3A5] rounded-xl flex items-center justify-center hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 text-[#3E435D]" />
              </Link>
              <div>
                <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">SurgiSense</h1>
                <p className="text-[#9AA7B1] text-xs">Surgery Readiness Check</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Home</Link>
                <Link to="/chat" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Chat</Link>
                <Link to="/surgery-readiness" className="px-3 py-1.5 rounded-lg text-[#CBC3A5] text-sm font-medium bg-[#CBC3A5]/10">Readiness</Link>
                <Link to="/pharmacy" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Pharmacy</Link>
              </div>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-[#D3D0BC] hover:bg-white/10 p-2 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed left-0 right-0 bg-[#3E435D]/95 backdrop-blur-md z-40 border-b border-white/5 md:hidden"
            style={{ top: headerRef.current ? headerRef.current.offsetHeight + "px" : "80px" }}
          >
            <div className="px-5 py-3 space-y-1">
              {[
                { to: "/dashboard", icon: Home, label: "Dashboard" },
                { to: "/chat", icon: MessageCircle, label: "AI Chat" },
                { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness" },
                { to: "/pharmacy", icon: Pill, label: "Pharmacy" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-[#CBC3A5]" />
                  <span className="text-[#D3D0BC] text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-5 pt-24 pb-24 space-y-6">
        {/* Page Header */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 bg-[#3E435D] rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#CBC3A5]" />
            </div>
            <div>
              <h2 className="text-[#3E435D] text-2xl font-bold tracking-tight">Surgery Readiness</h2>
              <p className="text-[#9AA7B1] text-sm">Pre-operative vitals evaluation</p>
            </div>
          </div>
        </motion.div>

        {/* Surgery Type Selection */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5"
        >
          <h3 className="text-[#3E435D] text-sm font-bold mb-3">Select Surgery Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {surgeryOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSurgery(opt.value); setResult(null); setError(""); }}
                className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${
                  surgery === opt.value
                    ? "border-[#3E435D] bg-[#3E435D] text-[#D3D0BC] shadow-md shadow-[#3E435D]/15"
                    : "border-[#CBC3A5]/40 bg-[#D3D0BC]/10 text-[#3E435D] hover:border-[#CBC3A5] hover:bg-[#D3D0BC]/20"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </motion.section>

        {/* Vitals Input */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5"
        >
          <h3 className="text-[#3E435D] text-sm font-bold mb-4">Patient Vitals</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vitalFields.map((field) => (
              <div key={field.key} className="relative">
                <label className="flex items-center gap-2 text-xs font-medium text-[#3E435D] mb-1.5">
                  <field.icon className="w-3.5 h-3.5 text-[#9AA7B1]" />
                  {field.label}
                  <span className="text-[#9AA7B1] font-normal">({field.unit})</span>
                </label>
                <input
                  type={field.type}
                  step={field.step || undefined}
                  placeholder={field.placeholder}
                  value={vitals[field.key]}
                  onChange={(e) => handleVitalChange(field.key, e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#CBC3A5]/40 bg-[#D3D0BC]/10 text-[#3E435D] text-sm font-medium placeholder:text-[#9AA7B1]/60 focus:outline-none focus:border-[#3E435D] focus:ring-1 focus:ring-[#3E435D]/20 transition-all"
                />
              </div>
            ))}
          </div>
        </motion.section>

        {/* Action Buttons */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="flex gap-3">
          <button
            onClick={handleEvaluate}
            disabled={!allFieldsFilled || loading}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
              !allFieldsFilled
                ? "bg-[#9AA7B1]/20 text-[#9AA7B1] cursor-not-allowed"
                : loading
                ? "bg-[#3E435D]/70 text-[#D3D0BC] cursor-wait"
                : "bg-[#3E435D] text-[#D3D0BC] hover:bg-[#4a5070] shadow-md shadow-[#3E435D]/15"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Evaluating...
              </>
            ) : (
              <>
                <ShieldCheck size={16} /> Evaluate Readiness
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="px-5 py-3 rounded-xl font-semibold text-sm border-2 border-[#CBC3A5]/40 text-[#3E435D] hover:bg-[#D3D0BC]/20 transition-all active:scale-[0.98]"
          >
            Reset
          </button>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2"
            >
              <XCircle size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {result && statusInfo && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
              className={`rounded-2xl p-6 border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${statusInfo.iconBg}`}>
                  <statusInfo.icon className={`w-7 h-7 ${statusInfo.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-xl font-bold mb-1 ${statusInfo.textColor}`}>
                    {statusInfo.label}
                  </h3>
                  <p className={`text-sm leading-relaxed opacity-80 ${statusInfo.textColor}`}>
                    {statusInfo.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-current/10">
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 opacity-60 ${statusInfo.textColor}`}>
                      Submitted Vitals
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {vitalFields.map((field) => (
                        <div key={field.key} className="bg-white/60 rounded-lg p-2">
                          <p className="text-[10px] text-[#9AA7B1] font-medium">{field.label}</p>
                          <p className="text-sm font-bold text-[#3E435D]">
                            {vitals[field.key]} <span className="text-[10px] font-normal text-[#9AA7B1]">{field.unit}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Back to Dashboard */}
        <Link
          to="/dashboard"
          className="group block bg-[#3E435D] rounded-2xl p-5 shadow-lg shadow-[#3E435D]/10 hover:shadow-xl transition-all"
        >
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#3E435D]/10 px-4 py-2.5 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          {[
            { to: "/dashboard", icon: Home, label: "Home", active: false },
            { to: "/chat", icon: MessageCircle, label: "Chat", active: false },
            { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness", active: true },
            { to: "/pharmacy", icon: Pill, label: "Meds", active: false },
          ].map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                item.active ? "text-[#3E435D]" : "text-[#9AA7B1] hover:text-[#3E435D]"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

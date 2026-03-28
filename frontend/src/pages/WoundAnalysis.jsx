import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart, Home, MessageCircle, ShieldCheck, Pill, Camera,
  Menu, X, LogOut, Bell, Activity, AlertTriangle, CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "../components/ui/Progress";
import Vision from "../Vision";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import { useEffect, useRef } from "react";
import surgiLogo from "../assets/surgisense-logo.jpeg";

const API_BASE = "http://localhost:8000";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function WoundAnalysis() {
  const [woundAnalysis, setWoundAnalysis] = useState(null);
  const [woundPreview, setWoundPreview] = useState(null);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [bellAlerts, setBellAlerts] = useState([]);
  const headerRef = useRef(null);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    axios.get(`${API_BASE}/api/profile`, getAuthHeaders())
      .then(r => setProfile(r.data)).catch(() => {});
    axios.get(`${API_BASE}/api/agent/alerts`, getAuthHeaders())
      .then(r => { if (r.data?.alerts) setBellAlerts(r.data.alerts); }).catch(() => {});

    const handleScroll = () => {
      const y = window.scrollY;
      if (y < lastScrollYRef.current || y < 10) setIsNavVisible(true);
      else if (y > lastScrollYRef.current && y > 80) { setIsNavVisible(false); setIsMenuOpen(false); }
      lastScrollYRef.current = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getSeverityDetails = (text) => {
    if (!text) return null;
    const match =
      text.match(/(\d+)\s*(?:\/|out of)\s*10|\\boxed\{(\d+)\}/i) ||
      text.match(/(?:severity|score)[\s:]*(\d+)/i);
    const score = match ? parseInt(match[1] || match[2], 10) : null;
    if (!score || score < 1 || score > 10) return null;
    if (score <= 3) return { score, barColor: "bg-emerald-400", bgColor: "bg-emerald-50", textColor: "text-emerald-700", label: "Low Risk", icon: CheckCircle, border: "border-emerald-200" };
    if (score <= 6) return { score, barColor: "bg-amber-400", bgColor: "bg-amber-50", textColor: "text-amber-700", label: "Monitor Closely", icon: Activity, border: "border-amber-200" };
    return { score, barColor: "bg-red-400", bgColor: "bg-red-50", textColor: "text-red-600", label: "Critical Alert", icon: AlertTriangle, border: "border-red-200" };
  };

  const severity = getSeverityDetails(woundAnalysis);

  const recoveryData = {
    patientName: profile?.patient_name || "",
    surgeryType: profile?.surgery_type || "",
    recoveryDay: profile?.surgery_date
      ? Math.max(0, Math.floor((Date.now() - new Date(profile.surgery_date)) / 86400000))
      : 0,
    progress: profile?.surgery_date
      ? Math.min(Math.round((Math.max(0, Math.floor((Date.now() - new Date(profile.surgery_date)) / 86400000)) / (profile.recovery_days_total || 90)) * 100), 100)
      : 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D3D0BC] to-[#D3D0BC]/90">

      {/* NAVBAR */}
      <header ref={headerRef} className={`fixed top-0 left-0 right-0 z-40 bg-[#3E435D]/95 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${isNavVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="max-w-7xl mx-auto px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="w-11 h-11 hover:scale-105 transition-transform flex-shrink-0">
                <img src={surgiLogo} alt="SurgiSense" className="w-full h-full object-contain" style={{mixBlendMode:'screen', filter:'brightness(1.15) contrast(1.05)'}} />
              </Link>
              <div>
                <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">{recoveryData.patientName}</h1>
                <p className="text-[#9AA7B1] text-xs">{recoveryData.surgeryType} · Day {recoveryData.recoveryDay}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Bell */}
              <div className="relative">
                <button onClick={() => setIsBellOpen(!isBellOpen)} className="relative p-2 rounded-lg text-[#D3D0BC]/70 hover:bg-[#CBC3A5]/10 transition-colors">
                  <Bell className="w-5 h-5" />
                  {bellAlerts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-lg">
                      {bellAlerts.length > 9 ? "9+" : bellAlerts.length}
                    </span>
                  )}
                </button>
              </div>
              <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Home</Link>
                <Link to="/chat" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Chat</Link>
                <Link to="/wound-analysis" className="px-3 py-1.5 rounded-lg text-[#CBC3A5] text-sm font-medium bg-[#CBC3A5]/10">Wound Check</Link>
                <Link to="/surgery-readiness" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Readiness</Link>
                <Link to="/pharmacy" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Pharmacy</Link>
                <Link to="/login" onClick={() => { localStorage.clear(); }} className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </Link>
              </div>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-[#D3D0BC] hover:bg-white/10 p-2 rounded-lg transition-colors">
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={recoveryData.progress} className="h-1.5 bg-white/10 flex-1" />
            <span className="text-[#CBC3A5] text-xs font-medium whitespace-nowrap">{recoveryData.progress}%</span>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed left-0 right-0 bg-[#3E435D]/95 backdrop-blur-md z-40 border-b border-white/5 md:hidden"
            style={{ top: headerRef.current ? headerRef.current.offsetHeight + "px" : "80px" }}>
            <div className="px-5 py-3 space-y-1">
              {[
                { to: "/dashboard", icon: Home, label: "Dashboard" },
                { to: "/chat", icon: MessageCircle, label: "AI Chat" },
                { to: "/wound-analysis", icon: Camera, label: "Wound Check" },
                { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness" },
                { to: "/pharmacy", icon: Pill, label: "Pharmacy" },
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

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-5 pt-28 pb-24 space-y-6">

        {/* Page title */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn}>
          <h1 className="text-2xl font-bold text-[#3E435D] tracking-tight">Wound Analysis</h1>
          <p className="text-[#9AA7B1] text-sm mt-1">Upload a surgical site photo for AI-powered clinical assessment</p>
        </motion.div>

        {/* Upload + Analyze card */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn}>
          <Vision onAnalysisComplete={(analysis, preview) => {
            setWoundAnalysis(analysis);
            setWoundPreview(preview);
          }} />
        </motion.div>

        {/* Results card — shown after analysis */}
        <AnimatePresence>
          {woundAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="space-y-4"
            >
              {/* Severity score */}
              {severity && (
                <div className={`rounded-2xl border p-5 ${severity.bgColor} ${severity.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`flex items-center gap-2 font-bold text-base ${severity.textColor}`}>
                      <severity.icon className="w-5 h-5" />
                      {severity.label}
                    </div>
                    <span className={`text-2xl font-extrabold ${severity.textColor}`}>{severity.score}<span className="text-sm font-semibold opacity-60">/10</span></span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-2.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(severity.score / 10) * 100}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-2.5 rounded-full ${severity.barColor}`}
                    />
                  </div>
                </div>
              )}

              {/* Preview + full analysis */}
              <div className="grid md:grid-cols-2 gap-4">
                {woundPreview && (
                  <div className="rounded-2xl overflow-hidden border border-[#3E435D]/10 aspect-square">
                    <img src={woundPreview} alt="Wound site" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#3E435D]/5 p-5 flex flex-col">
                  <h4 className="text-[10px] font-bold text-[#9AA7B1] uppercase tracking-widest mb-3">AI Assessment</h4>
                  <div className="text-sm text-[#3E435D] leading-relaxed overflow-y-auto flex-1 prose prose-sm prose-headings:text-[#3E435D] max-h-72">
                    <ReactMarkdown>{woundAnalysis}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-[#9AA7B1] text-center px-4">
                This AI assessment is for monitoring purposes only. Always consult your surgeon for clinical decisions.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#3E435D]/10 px-4 py-2.5 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          {[
            { to: "/dashboard", icon: Home, label: "Home" },
            { to: "/chat", icon: MessageCircle, label: "Chat" },
            { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness" },
            { to: "/pharmacy", icon: Pill, label: "Meds" },
          ].map(item => (
            <Link key={item.label} to={item.to}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors text-[#9AA7B1] hover:text-[#3E435D]">
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Activity,
  FileText,
  Camera,
  MessageCircle,
  Pill,
  ChevronRight,
  Menu,
  X,
  Home,
  Upload,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Progress } from "../components/ui/Progress";
import ReactMarkdown from 'react-markdown';
import Vision from "../Vision";
import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "http://localhost:8000";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Dashboard() {
  const [digitizedData, setDigitizedData] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const headerRef = useRef(null);

  const [woundAnalysis, setWoundAnalysis] = useState(null);
  const [woundPreview, setWoundPreview] = useState(null);

  const handleWoundAnalysis = (analysis, preview) => {
    setWoundAnalysis(analysis);
    setWoundPreview(preview);
  };

  const getWoundSeverity = (text) => {
    if (!text) return null;
    const match =
      text.match(/(\d+)\s*(?:\/|out of)\s*10|\\boxed\{(\d+)\}/i) ||
      text.match(/(?:severity|score)[\s:]*(\d+)/i);
    const score = match ? parseInt(match[1] || match[2], 10) : null;
    if (!score || score < 1 || score > 10) return null;
    if (score <= 3) return { score, barColor: 'bg-[#9AA7B1]', bgColor: 'bg-[#D3D0BC]/30', textColor: 'text-[#3E435D]', label: 'Low Risk' };
    if (score <= 6) return { score, barColor: 'bg-[#CBC3A5]', bgColor: 'bg-[#CBC3A5]/20', textColor: 'text-[#3E435D]', label: 'Monitor Closely' };
    return { score, barColor: 'bg-[#d4183d]', bgColor: 'bg-[#d4183d]/10', textColor: 'text-[#d4183d]', label: 'Critical Alert' };
  };

  const woundSeverity = getWoundSeverity(woundAnalysis);

  const [tasks, setTasks] = useState([
    { id: 'placeholder', title: "Upload Discharge Summary to generate today's schedule.", time: "--", status: "pending", type: "info" }
  ]);

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

  const recoveryData = {
    patientName: digitizedData?.patient_name || "Margaret Johnson",
    surgeryType: digitizedData?.surgery_type || digitizedData?.procedure || "Hip Replacement",
    recoveryDay: 8,
    totalDays: 90,
    progress: 9,
  };

  const toggleTaskStatus = (taskId) => {
    if (taskId === 'placeholder') return;
    setTasks(tasks.map(task =>
      task.id === taskId
        ? { ...task, status: task.status === 'pending' ? 'completed' : 'pending' }
        : task
    ));
  };

  const handleDischargeUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setLoadingRecord(true);
      const res = await axios.post(`${API_BASE}/api/digitize-record`, formData);
      const extractedData = res.data.data;
      setDigitizedData(extractedData);
      const medsArray = extractedData?.medication_list || extractedData?.medications || [];
      localStorage.setItem('surgisense_active_meds', JSON.stringify(medsArray));
      try {
        const tasksRes = await axios.post(`${API_BASE}/api/generate-tasks`, {
          document_text: JSON.stringify(extractedData)
        });
        if (tasksRes.data.status === 'success' && tasksRes.data.tasks.length > 0) {
          setTasks(tasksRes.data.tasks);
        }
      } catch (taskErr) {
        console.error("Task generation failed", taskErr);
      }
    } catch (err) {
      console.error("Digitization failed", err);
    } finally {
      setLoadingRecord(false);
    }
  };

  const dischargeInfo = digitizedData
    ? [
        { label: "Procedure", value: digitizedData.surgery_type || digitizedData.procedure || "—" },
        { label: "Follow-up Date", value: digitizedData.follow_up_date || "—" },
        { label: "Doctor", value: digitizedData.doctor || "—" },
        { label: "Medications", value: `${digitizedData.medication_list?.length || digitizedData.medications?.length || 0} prescriptions` },
      ]
    : [];

  const activeMedications = digitizedData?.medication_list || digitizedData?.medications || [];

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.filter(t => t.id !== 'placeholder').length;

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
                <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">{recoveryData.patientName}</h1>
                <p className="text-[#9AA7B1] text-xs">{recoveryData.surgeryType} · Day {recoveryData.recoveryDay}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-[#CBC3A5] text-sm font-medium bg-[#CBC3A5]/10">Home</Link>
                <Link to="/chat" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Chat</Link>
                <Link to="/surgery-readiness" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Readiness</Link>
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

          {/* Progress bar in header */}
          <div className="mt-3 flex items-center gap-3">
            <Progress value={recoveryData.progress} className="h-1.5 bg-white/10 flex-1" />
            <span className="text-[#CBC3A5] text-xs font-medium whitespace-nowrap">{recoveryData.progress}%</span>
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
            style={{ top: headerRef.current ? headerRef.current.offsetHeight + 'px' : '80px' }}
          >
            <div className="px-5 py-3 space-y-1">
              {[
                { to: "/dashboard", icon: Home, label: "Dashboard" },
                { to: "/chat", icon: MessageCircle, label: "AI Chat" },
                { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness" },
                { to: "/pharmacy", icon: Pill, label: "Pharmacy" },
              ].map(item => (
                <Link key={item.to} to={item.to} onClick={() => setIsMenuOpen(false)}
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
      <div className="max-w-7xl mx-auto px-5 pt-28 pb-24 space-y-6">
        {/* Quick Actions */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "#timeline", icon: Calendar, label: "Timeline", color: "bg-[#3E435D]" },
            { href: "#wound", icon: Camera, label: "Wound Check", color: "bg-[#3E435D]" },
            { to: "/chat", icon: MessageCircle, label: "AI Chat", color: "bg-[#3E435D]" },
            { to: "/pharmacy", icon: Pill, label: "Pharmacy", color: "bg-[#3E435D]" },
          ].map((item) => {
            const Wrapper = item.to ? Link : 'a';
            const wrapperProps = item.to ? { to: item.to } : { href: item.href };
            return (
              <Wrapper key={item.label} {...wrapperProps}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-2.5 border border-[#3E435D]/5 hover:bg-white hover:shadow-lg hover:shadow-[#3E435D]/5 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className={`${item.color} w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-5 h-5 text-[#CBC3A5]" />
                </div>
                <span className="text-[#3E435D] font-medium text-sm">{item.label}</span>
              </Wrapper>
            );
          })}
        </motion.div>

        {/* Recovery Timeline */}
        <motion.section
          id="timeline"
          className="scroll-mt-28"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#3E435D] text-xl font-bold tracking-tight">Today's Recovery Tasks</h2>
            {totalTasks > 0 && (
              <span className="text-[#9AA7B1] text-sm font-medium">{completedTasks}/{totalTasks} done</span>
            )}
          </div>
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTaskStatus(task.id)}
                className={`group bg-white/80 backdrop-blur-sm rounded-xl p-4 border-l-[3px] cursor-pointer transition-all duration-200 hover:bg-white hover:shadow-md ${
                  task.status === "completed" ? "border-[#9AA7B1] opacity-70" :
                  task.status === "alert" ? "border-[#d4183d]" : "border-[#CBC3A5]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {task.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-[#9AA7B1] shrink-0" />
                    ) : task.status === "alert" ? (
                      <AlertCircle className="w-5 h-5 text-[#d4183d] shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-[#CBC3A5] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className={`font-medium text-sm truncate ${task.status === 'completed' ? 'text-[#9AA7B1] line-through' : 'text-[#3E435D]'}`}>
                        {task.title}
                      </h3>
                      <p className="text-[#9AA7B1] text-xs mt-0.5">{task.time}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 ${
                    task.status === "completed" ? "bg-[#9AA7B1]/15 text-[#9AA7B1]" :
                    task.status === "alert" ? "bg-[#d4183d]/10 text-[#d4183d]" : "bg-[#CBC3A5]/20 text-[#3E435D]"
                  }`}>
                    {task.status === "completed" ? "Done" : task.status === "alert" ? "Review" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Discharge Summary Card */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#CBC3A5]" />
            </div>
            <h2 className="text-[#3E435D] text-lg font-bold">Discharge Summary</h2>
          </div>
          {!digitizedData ? (
            <div className="border-2 border-dashed border-[#CBC3A5]/50 rounded-xl p-8 text-center bg-[#D3D0BC]/10">
              <Upload className="w-10 h-10 text-[#9AA7B1] mx-auto mb-3" />
              <p className="text-[#3E435D] font-semibold text-sm mb-1">Upload Discharge Summary</p>
              <p className="text-[#9AA7B1] text-xs mb-4">PDF format supported</p>
              <input type="file" accept="application/pdf" className="hidden" id="discharge-upload" onChange={(e) => handleDischargeUpload(e.target.files[0])} />
              <label htmlFor="discharge-upload" className="inline-flex items-center gap-2 bg-[#3E435D] text-[#D3D0BC] px-5 py-2.5 rounded-xl cursor-pointer hover:bg-[#4a5070] transition-colors text-sm font-semibold shadow-md shadow-[#3E435D]/15">
                {loadingRecord ? (
                  <><span className="w-4 h-4 border-2 border-[#D3D0BC]/30 border-t-[#D3D0BC] rounded-full animate-spin" /> Processing...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Upload & Digitize</>
                )}
              </label>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {dischargeInfo.map((item, index) => (
                <div key={index} className="bg-[#D3D0BC]/15 rounded-xl p-3.5">
                  <p className="text-[#9AA7B1] text-xs font-medium mb-1">{item.label}</p>
                  <p className="text-[#3E435D] font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wound Check & Results - Side by side on desktop */}
        <div className="grid lg:grid-cols-2 gap-5">
          <section id="wound" className="scroll-mt-28">
            <Vision onAnalysisComplete={handleWoundAnalysis} />
          </section>
          <section>
            <div className="w-full bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-[#3E435D]/5 h-full flex flex-col">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#3E435D] rounded-xl flex items-center justify-center">
                  <Activity className="text-[#CBC3A5]" size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#3E435D] leading-tight">Wound Analysis Results</h3>
                  <p className="text-[11px] text-[#9AA7B1]">AI-powered clinical assessment</p>
                </div>
              </div>

              {!woundAnalysis ? (
                <div className="border-2 border-dashed border-[#CBC3A5]/40 rounded-xl p-4 flex-1 flex flex-col items-center justify-center min-h-32 bg-[#D3D0BC]/10">
                  <Camera size={24} className="text-[#9AA7B1] opacity-60 mb-1.5" />
                  <span className="text-xs text-[#9AA7B1]">Upload and analyze a wound photo to see results</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  {woundSeverity && (
                    <div className={`p-3.5 rounded-xl border border-[#3E435D]/5 ${woundSeverity.bgColor}`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className={`flex items-center gap-2 font-bold text-sm ${woundSeverity.textColor}`}>
                          {woundSeverity.score <= 3 ? <CheckCircle size={16} /> : woundSeverity.score <= 6 ? <Activity size={16} /> : <AlertCircle size={16} />}
                          <span>{woundSeverity.label}</span>
                        </div>
                        <span className={`font-extrabold text-base ${woundSeverity.textColor}`}>{woundSeverity.score}/10</span>
                      </div>
                      <div className="w-full bg-[#D3D0BC]/50 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(woundSeverity.score / 10) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-2 rounded-full ${woundSeverity.barColor}`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-[#D3D0BC]/10 p-3.5 rounded-xl border border-[#3E435D]/5 flex-1">
                    <h4 className="text-[10px] font-bold text-[#9AA7B1] uppercase tracking-wider mb-2">AI Assessment</h4>
                    <div className="text-xs text-[#3E435D] leading-relaxed overflow-y-auto max-h-48 pr-1.5 prose prose-sm prose-headings:text-[#3E435D]">
                      <ReactMarkdown>{woundAnalysis}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Medications */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
                <Pill className="w-5 h-5 text-[#CBC3A5]" />
              </div>
              <h2 className="text-[#3E435D] text-lg font-bold">Medications</h2>
            </div>
            <Link to="/pharmacy" className="group text-[#3E435D] font-medium text-sm flex items-center gap-1 hover:gap-1.5 transition-all">
              View All <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          {activeMedications.length > 0 ? (
            <div className="space-y-2.5">
              {activeMedications.slice(0, 3).map((med, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-[#D3D0BC]/10 border border-[#3E435D]/5">
                  <div className="w-2 h-8 bg-[#CBC3A5] rounded-full shrink-0" />
                  <div>
                    <h3 className="text-[#3E435D] font-semibold text-sm">{med.name || med.medication_name || "Prescription"}</h3>
                    <p className="text-[#9AA7B1] text-xs">{med.dosage || med.instructions || "Take as directed"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-[#CBC3A5]/30 rounded-xl bg-[#D3D0BC]/10">
              <Pill className="w-8 h-8 text-[#9AA7B1] mx-auto mb-2" />
              <p className="text-[#9AA7B1] text-sm">Upload a discharge summary to see medications.</p>
            </div>
          )}
        </section>

        {/* AI Chat CTA */}
        <Link to="/chat" className="group block bg-[#3E435D] rounded-2xl p-5 shadow-lg shadow-[#3E435D]/10 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#CBC3A5] w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-[#3E435D]" />
              </div>
              <div>
                <h3 className="text-[#D3D0BC] font-semibold">Need Help?</h3>
                <p className="text-[#9AA7B1] text-sm">Chat with AI Recovery Assistant</p>
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
            { to: "/dashboard", icon: Home, label: "Home", active: true },
            { to: "/chat", icon: MessageCircle, label: "Chat", active: false },
            { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness", active: false },
            { to: "/pharmacy", icon: Pill, label: "Meds", active: false },
          ].map((item) => {
            const Wrapper = item.to ? Link : 'a';
            const wrapperProps = item.to ? { to: item.to } : { href: item.href };
            return (
              <Wrapper key={item.label} {...wrapperProps}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                  item.active ? 'text-[#3E435D]' : 'text-[#9AA7B1] hover:text-[#3E435D]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Wrapper>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
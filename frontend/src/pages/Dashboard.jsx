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
  LogOut,
} from "lucide-react";
import { Progress } from "../components/ui/Progress";
import ReactMarkdown from 'react-markdown';
import Vision from "../Vision";
import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MedicationSelector from "../components/ui/medication_selector";

const API_BASE = "http://localhost:8000";
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, []);

  const [digitizedData, setDigitizedData] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const lastScrollYRef = useRef(0);
  const headerRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [woundAnalysis, setWoundAnalysis] = useState(null);
  const [woundPreview, setWoundPreview] = useState(null);

  const [pendingMedsData, setPendingMedsData] = useState(null);
  const [dbMedications, setDbMedications] = useState(null);
  const [togglingTaskId, setTogglingTaskId] = useState(null);

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

  const [viewDate, setViewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const notifiedTaskIds = useRef(new Set());

  const fetchUserRecords = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/my-records`, getAuthHeaders());
      if (res.data.length > 0) {
        const latest = res.data[res.data.length - 1];
        const parsed = JSON.parse(latest.content);
        setDigitizedData(parsed);
      }
    } catch (err) {
      console.error("Failed to load records", err);
    }
  };

  const fetchTasks = async (dateStr) => {
    const date = dateStr || new Date().toISOString().slice(0, 10);
    try {
      const res = await axios.get(`${API_BASE}/api/my-tasks?date=${date}`, getAuthHeaders());
      if (res.data && res.data.length > 0) {
        setTasks(res.data);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/profile`, getAuthHeaders());
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to load profile", err);
    }
  };

  const fetchMedicines = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/my-medicines`, getAuthHeaders());
      if (res.data?.status === "success" && res.data.data?.length > 0) {
        setDbMedications(res.data.data);
        localStorage.setItem('surgisense_active_meds', JSON.stringify(res.data.data));
      }
    } catch (err) {
      console.error("Failed to load medicines from DB", err);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, getAuthHeaders());
    } catch (err) {}
    localStorage.removeItem("token");
    localStorage.removeItem("surgisense_active_meds");
    navigate("/login");
  };

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const pollOverdue = async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const res = await axios.get(`${API_BASE}/api/overdue-tasks`, getAuthHeaders());
        (res.data.overdue || []).forEach(task => {
          if (notifiedTaskIds.current.has(task.id)) return;
          notifiedTaskIds.current.add(task.id);
          new Notification('⚠️ Overdue task — SurgiSense', {
            body: `${task.title} was due at ${task.time} · ${task.minutes_overdue} min ago`,
            icon: '/favicon.ico',
            tag: `task-${task.id}`,
          });
        });
      } catch (_) {}
    };
    pollOverdue();
    const interval = setInterval(pollOverdue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchUserRecords();
    fetchProfile();
    fetchTasks(new Date().toISOString().slice(0, 10));
    fetchMedicines();

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

  useEffect(() => {
    fetchTasks(viewDate);
  }, [viewDate]);

  const calculateRecoveryDay = (date) => {
    if (!date) return 0;
    const surgeryDate = new Date(date);
    const today = new Date();
    const diff = today - surgeryDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return Math.max(days, 0);
  };

  const calculateRecoveryProgress = (date, totalDays = 90) => {
    const day = calculateRecoveryDay(date);
    return Math.min(Math.round((day / totalDays) * 100), 100);
  };

  const recoveryData = {
    patientName: profile?.patient_name || "",
    surgeryType: profile?.surgery_type || "",
    recoveryDay: calculateRecoveryDay(profile?.surgery_date),
    totalDays: profile?.recovery_days_total || 90,
    progress: calculateRecoveryProgress(profile?.surgery_date, profile?.recovery_days_total || 90)
  };

  // ── THE UPGRADED INVENTORY SYNC TOGGLE ────────────────────────────────
  const toggleTaskStatus = async (taskId) => {
    if (togglingTaskId) return;
    try {
      const taskToUpdate = tasks.find(t => t.id === taskId);
      if (!taskToUpdate || taskToUpdate.status === "completed") return;

      setTogglingTaskId(taskId); 
      await axios.patch(`${API_BASE}/api/task/${taskId}`, {}, getAuthHeaders());
      setTasks(tasks.map(task => task.id === taskId ? { ...task, status: "completed" } : task));

      // Real-Time Pill Deduction
      if (taskToUpdate.title.toLowerCase().includes("medication")) {
        let medNameFromTask = taskToUpdate.title;
        if (taskToUpdate.title.includes("-")) medNameFromTask = taskToUpdate.title.split("-")[1].trim();
        else if (taskToUpdate.title.includes(":")) medNameFromTask = taskToUpdate.title.split(":")[1].trim();

        if (medNameFromTask) {
          try {
            await axios.post(`${API_BASE}/api/inventory/deduct`, { medicine_name: medNameFromTask }, getAuthHeaders());
            console.log(`✅ DB inventory deducted for: ${medNameFromTask}`);
            fetchMedicines(); // Pulls the fresh, lower pill count from DB
          } catch (deductErr) {
            console.warn("DB deduct failed:", deductErr);
          }
        }
      }
    } catch (err) {
      console.error("Failed to update task", err);
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleDischargeUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setLoadingRecord(true);
      const res = await axios.post(`${API_BASE}/api/digitize-record`, formData, getAuthHeaders());
      const extractedData = res.data.data;
      setDigitizedData(extractedData);
      setPendingMedsData(extractedData);

      try {
        const tasksRes = await axios.post(`${API_BASE}/api/generate-daily-tasks`, {
          document_text: JSON.stringify(extractedData)
        }, getAuthHeaders());
        if (tasksRes.data.tasks && tasksRes.data.tasks.length > 0) setTasks(tasksRes.data.tasks);
      } catch (taskErr) {
        try {
          const fallback = await axios.post(`${API_BASE}/api/generate-tasks`, {
            document_text: JSON.stringify(extractedData)
          }, getAuthHeaders());
          if (fallback.data.tasks && fallback.data.tasks.length > 0) setTasks(fallback.data.tasks);
        } catch (_) {}
      }
    } catch (err) {
      console.error("Digitization failed", err);
    } finally {
      setLoadingRecord(false);
    }
  };

  const dischargeInfo = digitizedData ? [
    { label: "Procedure", value: digitizedData.surgery_type || digitizedData.procedure || "—" },
    { label: "Follow-up Date", value: digitizedData.follow_up_date || "—" },
    { label: "Doctor", value: digitizedData.doctor || "—" },
    { label: "Medications", value: `${digitizedData.medication_list?.length || digitizedData.medications?.length || 0} prescriptions` },
  ] : [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const realTasks = tasks.filter(t => t.id !== 'placeholder');
  const completedTasks = realTasks.filter(t => t.status === 'completed').length;
  const totalTasks = realTasks.length;
  const hasOverdueCritical = realTasks.some(t =>
    t.is_critical === 1 && t.status === 'pending' && (() => {
      try {
        const [time, meridiem] = (t.time || '').split(' ');
        const [h, m] = time.split(':').map(Number);
        const now = new Date();
        const taskDate = new Date();
        let hours = h;
        if (meridiem === 'PM' && h !== 12) hours += 12;
        if (meridiem === 'AM' && h === 12) hours = 0;
        taskDate.setHours(hours, m, 0, 0);
        return (now - taskDate) / 60000 >= 120;
      } catch { return false; }
    })()
  );

  const activeMedications = dbMedications ? dbMedications : (() => {
    const savedMedsRaw = localStorage.getItem('surgisense_active_meds');
    return savedMedsRaw ? JSON.parse(savedMedsRaw) : (digitizedData?.medication_list || digitizedData?.medications || []);
  })();

  useEffect(() => {
    if (profile && profile.profile_exists === false) {
      navigate("/setup-profile");
    }
  }, [profile]);

  if (!profile) return <div className="min-h-screen bg-[#D3D0BC] flex items-center justify-center text-[#3E435D] font-medium">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D3D0BC] to-[#D3D0BC]/90">

      {/* POP-UP OVERLAY FOR MEDICATION SELECTOR */}
      <AnimatePresence>
        {pendingMedsData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E435D]/60 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="w-full max-w-md">
              <MedicationSelector extractedData={pendingMedsData} onComplete={() => { setPendingMedsData(null); navigate("/pharmacy"); }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVBAR */}
      <header ref={headerRef} className={`fixed top-0 left-0 right-0 z-40 bg-[#3E435D]/95 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${isNavVisible ? "translate-y-0" : "-translate-y-full"}`}>
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
              <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className="px-3 py-1.5 rounded-lg text-[#CBC3A5] text-sm font-medium bg-[#CBC3A5]/10">Home</Link>
                <Link to="/chat" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Chat</Link>
                <Link to="/pharmacy" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Pharmacy</Link>
                <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
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
              <Wrapper key={item.label} {...wrapperProps} className="group bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-2.5 border border-[#3E435D]/5 hover:bg-white hover:shadow-lg hover:shadow-[#3E435D]/5 transition-all duration-300 hover:-translate-y-0.5">
                <div className={`${item.color} w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-5 h-5 text-[#CBC3A5]" />
                </div>
                <span className="text-[#3E435D] font-medium text-sm">{item.label}</span>
              </Wrapper>
            );
          })}
        </motion.div>

        {/* Recovery Tasks */}
        <motion.section id="timeline" className="scroll-mt-28" initial="hidden" animate="visible" variants={fadeIn}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[#3E435D] text-xl font-bold tracking-tight">Recovery Tasks</h2>
            {totalTasks > 0 && <span className="text-[#9AA7B1] text-sm font-medium">{completedTasks}/{totalTasks} done</span>}
          </div>

          {hasOverdueCritical && viewDate === todayStr && (
            <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-medium">One or more critical tasks are overdue by 2+ hours. Please complete them immediately.</p>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i - 2);
              const dStr = d.toISOString().slice(0, 10);
              const isSelected = dStr === viewDate;
              return (
                <button
                  key={dStr} onClick={() => setViewDate(dStr)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all ${
                    isSelected ? 'bg-[#3E435D] border-[#3E435D] text-[#D3D0BC]' : 'bg-white/80 border-[#3E435D]/10 text-[#9AA7B1] hover:border-[#3E435D]/30'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide">{dStr === todayStr ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                  <span className={isSelected ? 'text-[#D3D0BC]' : 'text-[#3E435D]'}>{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {tasks.length === 0 || (tasks.length === 1 && tasks[0].id === 'placeholder') ? (
              <div className="bg-white/80 rounded-xl p-6 text-center border border-dashed border-[#CBC3A5]/50">
                <p className="text-[#9AA7B1] text-sm">No tasks scheduled for this day.</p>
                <p className="text-[#9AA7B1] text-xs mt-1">Upload a discharge summary to generate your schedule.</p>
              </div>
            ) : (
              tasks.filter(t => t.id !== 'placeholder').map((task) => {
                const isOverdue = task.is_critical === 1 && task.status === 'pending' && (() => {
                  try {
                    const [time, mer] = (task.time || '').split(' ');
                    const [h, m] = time.split(':').map(Number);
                    const now = new Date();
                    const td = new Date();
                    let hrs = h;
                    if (mer === 'PM' && h !== 12) hrs += 12;
                    if (mer === 'AM' && h === 12) hrs = 0;
                    td.setHours(hrs, m, 0, 0);
                    return (now - td) / 60000 >= 120;
                  } catch { return false; }
                })();

                return (
                  <div
                    key={task.id}
                    onClick={() => (viewDate === todayStr && !togglingTaskId) ? toggleTaskStatus(task.id) : null}
                    className={`group bg-white/80 backdrop-blur-sm rounded-xl p-4 border-l-[3px] transition-all duration-200
                      ${viewDate === todayStr && !togglingTaskId ? 'cursor-pointer hover:bg-white hover:shadow-md' : 'cursor-default opacity-80'}
                      ${togglingTaskId === task.id ? 'opacity-50 pointer-events-none' : ''}
                      ${task.status === 'completed' ? 'border-[#9AA7B1] opacity-60' : isOverdue ? 'border-red-400' : task.is_critical === 1 ? 'border-amber-400' : 'border-[#CBC3A5]'}
                    `}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {task.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-[#9AA7B1] shrink-0" />
                        ) : isOverdue ? (
                          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        ) : (
                          <Clock className={`w-5 h-5 shrink-0 ${task.is_critical === 1 ? 'text-amber-400' : 'text-[#CBC3A5]'}`} />
                        )}
                        <div className="min-w-0">
                          <h3 className={`font-medium text-sm truncate ${task.status === 'completed' ? 'text-[#9AA7B1] line-through' : 'text-[#3E435D]'}`}>
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[#9AA7B1] text-xs">{task.time}</p>
                            {task.is_critical === 1 && task.status !== 'completed' && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                {isOverdue ? 'OVERDUE' : 'CRITICAL'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 ${task.status === 'completed' ? 'bg-[#9AA7B1]/15 text-[#9AA7B1]' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-[#CBC3A5]/20 text-[#3E435D]'}`}>
                        {task.status === 'completed' ? 'Done' : isOverdue ? 'Overdue' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.section>

        {/* Wound Check */}
        <section id="wound" className="scroll-mt-28 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
            <Vision onAnalysisComplete={handleWoundAnalysis} />
            {woundAnalysis && (
              <div className="mt-4 p-4 rounded-xl bg-[#D3D0BC]/10 border border-[#3E435D]/10 text-sm text-[#3E435D]">
                <h4 className="font-bold mb-2">Analysis Results:</h4>
                <ReactMarkdown>{woundAnalysis}</ReactMarkdown>
              </div>
            )}
        </section>

        {/* UPGRADED Medications Section */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
                <Pill className="w-5 h-5 text-[#CBC3A5]" />
              </div>
              <h2 className="text-[#3E435D] text-lg font-bold">Medications</h2>
            </div>
            <Link to="/pharmacy" className="group text-[#3E435D] font-medium text-sm flex items-center gap-1 hover:gap-1.5 transition-all">
              Manage <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          
          {activeMedications.length > 0 ? (
            <div className="space-y-2.5">
              {activeMedications.slice(0, 3).map((med, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-[#D3D0BC]/10 border border-[#3E435D]/5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-[#CBC3A5] rounded-full shrink-0" />
                    <div>
                      <h3 className="text-[#3E435D] font-semibold text-sm">{med.name || med.medication_name || "Prescription"}</h3>
                      <p className="text-[#9AA7B1] text-xs">{med.dosage || med.instructions || "Take as directed"}</p>
                    </div>
                  </div>
                  {/* NEW VISUAL PILL COUNTER */}
                  {med.current_quantity !== undefined && (
                    <div className="flex flex-col items-end">
                      <span className="text-[#3E435D] text-sm font-bold">{med.current_quantity}</span>
                      <span className="text-[#9AA7B1] text-[10px] uppercase font-bold tracking-wider">Pills Left</span>
                    </div>
                  )}
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

      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#3E435D]/10 px-4 py-2.5 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          {[
            { to: "/dashboard", icon: Home, label: "Home", active: true },
            { to: "/chat", icon: MessageCircle, label: "Chat", active: false },
            { to: "/pharmacy", icon: Pill, label: "Meds", active: false },
          ].map((item) => {
            const Wrapper = item.to ? Link : 'a';
            return (
              <Wrapper key={item.label} to={item.to} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${item.active ? 'text-[#3E435D]' : 'text-[#9AA7B1] hover:text-[#3E435D]'}`}>
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
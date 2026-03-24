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

// IMPORT YOUR NEW COMPONENT HERE
import MedicationSelector from "../components/ui/medication_selector";
import AgentReportCard from "../components/ui/AgentReportCard";

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

  // NEW STATE: Controls when the Medication Pop-up shows
  const [pendingMedsData, setPendingMedsData] = useState(null);

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

  // viewDate: which day's tasks are shown ("YYYY-MM-DD"). Defaults to today.
  const [viewDate, setViewDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Set of task IDs we've already fired a notification for — prevents repeat alerts
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
      const res = await axios.get(
        `${API_BASE}/api/my-tasks?date=${date}`,
        getAuthHeaders()
      );
      if (res.data && res.data.length > 0) {
        setTasks(res.data);
      } else {
        // No tasks for this date — clear the list so the "no tasks" UI shows
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

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, getAuthHeaders());
    } catch (err) {
      console.error("Logout API call failed", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("surgisense_active_meds");
    navigate("/login");
  };

  // Notification permission + overdue polling every 5 minutes
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const pollOverdue = async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      try {
        const res = await axios.get(`${API_BASE}/api/overdue-tasks`, getAuthHeaders());
        (res.data.overdue || []).forEach(task => {
          if (notifiedTaskIds.current.has(task.id)) return; // already notified
          notifiedTaskIds.current.add(task.id);
          new Notification('⚠️ Overdue task — SurgiSense', {
            body: `${task.title} was due at ${task.time} · ${task.minutes_overdue} min ago`,
            icon: '/favicon.ico',
            tag: `task-${task.id}`,      // deduplicates OS-level toasts
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

  // Re-fetch whenever the user browses to a different date
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
    progress: calculateRecoveryProgress(
      profile?.surgery_date,
      profile?.recovery_days_total || 90
    )
  };

  const toggleTaskStatus = async (taskId) => {
    try {
      const taskToUpdate = tasks.find(t => t.id === taskId);
      if (!taskToUpdate || taskToUpdate.status === "completed") return;

      await axios.patch(`${API_BASE}/api/task/${taskId}`, {}, getAuthHeaders());

      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, status: "completed" } : task
      ));

      // --- SUPER INVENTORY SYNC LOGIC ---
      if (taskToUpdate.title.toLowerCase().includes("medication")) {
        // Find the medicine name from the task (Supports "-" or ":")
        const separator = taskToUpdate.title.includes("-") ? "-" : ":";
        const medNameFromTask = taskToUpdate.title.split(separator)[1]?.trim().toLowerCase();

        console.log(`Task clicked: ${taskToUpdate.title}. Searching inventory for:`, medNameFromTask);

        if (medNameFromTask) {
          let activeMeds = JSON.parse(localStorage.getItem('surgisense_active_meds')) || [];
          let wasUpdated = false;

          activeMeds = activeMeds.map(med => {
            const name = (med.name || med.medication_name || "").toLowerCase();

            // FUZZY MATCH: "amoxicillin 500mg" will now successfully match "amoxicillin"
            if (name.includes(medNameFromTask) || medNameFromTask.includes(name)) {
              console.log(`✅ Found match in inventory: ${med.name || med.medication_name}`);
              wasUpdated = true;

              // Check if they have set up inventory for this med on the Pharmacy page
              if (med.currentQuantity !== undefined && med.currentQuantity !== null) {
                const dose = med.doseAmount ? Number(med.doseAmount) : 1;
                const remaining = Math.max(0, med.currentQuantity - dose);

                console.log(`💊 Deducting ${dose} dose. Remaining: ${remaining}`);
                return {
                  ...med,
                  currentQuantity: remaining,
                  dosesTaken: (med.dosesTaken || 0) + 1
                };
              } else {
                console.log("⚠️ Inventory not set up for this med yet. Go to Pharmacy page to Track it first.");
              }
            }
            return med;
          });

          if (wasUpdated) {
            localStorage.setItem('surgisense_active_meds', JSON.stringify(activeMeds));
          } else {
            console.log("❌ Could not find a matching medication in local storage for this task.");
          }
        }
      }

    } catch (err) {
      console.error("Failed to update task", err);
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

      console.log("=== DIGITIZATION RESPONSE ===");
      console.log("Full response:", res.data);
      console.log("Extracted Data:", extractedData);
      console.log("Medications in extracted data:", extractedData?.medications);

      setDigitizedData(extractedData);

      // TRIGGER THE MODAL POPUP INSTEAD OF SAVING DIRECTLY
      setPendingMedsData(extractedData);

      try {
        // generate-daily-tasks creates a task schedule for every day until
        // surgery (pre-op) or for the next 14 days (post-op), then returns
        // today's slice. Falls back to single-day generate-tasks if needed.
        const tasksRes = await axios.post(`${API_BASE}/api/generate-daily-tasks`, {
          document_text: JSON.stringify(extractedData)
        }, getAuthHeaders());
        if (tasksRes.data.tasks && tasksRes.data.tasks.length > 0) {
          setTasks(tasksRes.data.tasks);
        }
      } catch (taskErr) {
        console.error("Task generation failed", taskErr);
        // Fallback to single-day
        try {
          const fallback = await axios.post(`${API_BASE}/api/generate-tasks`, {
            document_text: JSON.stringify(extractedData)
          }, getAuthHeaders());
          if (fallback.data.tasks && fallback.data.tasks.length > 0) {
            setTasks(fallback.data.tasks);
          }
        } catch (_) {}
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

  // Real-time active medications from local storage or fallback to AI data
  const savedMedsRaw = localStorage.getItem('surgisense_active_meds');
  const activeMedications = savedMedsRaw
    ? JSON.parse(savedMedsRaw)
    : (digitizedData?.medication_list || digitizedData?.medications || []);

  useEffect(() => {
    if (profile && profile.profile_exists === false) {
      navigate("/setup-profile");
    }
  }, [profile]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#D3D0BC] flex flex-col">
        {/* Skeleton navbar */}
        <div className="bg-[#3E435D] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#CBC3A5]/30 rounded-xl animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-32 h-3.5 bg-[#CBC3A5]/30 rounded-full animate-pulse" />
              <div className="w-20 h-2.5 bg-[#CBC3A5]/20 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="hidden md:flex gap-2">
            {[60, 40, 64, 52].map((w, i) => (
              <div key={i} className="h-7 rounded-lg bg-[#CBC3A5]/20 animate-pulse" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Centered pulse logo + message */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Animated heart logo */}
          <div className="relative flex items-center justify-center">
            {/* Outer ring pulse */}
            <div className="absolute w-24 h-24 rounded-full bg-[#3E435D]/10 animate-ping" style={{ animationDuration: '1.8s' }} />
            <div className="absolute w-16 h-16 rounded-full bg-[#3E435D]/15 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.3s' }} />
            {/* Core icon */}
            <div className="relative w-14 h-14 bg-[#3E435D] rounded-2xl flex items-center justify-center shadow-lg shadow-[#3E435D]/25">
              <svg className="w-7 h-7 text-[#CBC3A5]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="text-center space-y-1.5">
            <p className="text-[#3E435D] font-semibold text-base tracking-tight">SurgiSense</p>
            <p className="text-[#9AA7B1] text-sm">Loading your recovery dashboard…</p>
          </div>

          {/* Animated progress dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#3E435D]/40 animate-bounce"
                style={{ animationDelay: `${i * 0.18}s`, animationDuration: '0.9s' }}
              />
            ))}
          </div>
        </div>

        {/* Skeleton content preview */}
        <div className="px-5 pb-8 space-y-3 max-w-2xl mx-auto w-full">
          {/* Quick actions skeleton */}
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/50 rounded-2xl p-4 flex flex-col items-center gap-2 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[#3E435D]/10" />
                <div className="w-12 h-2.5 rounded-full bg-[#3E435D]/10" />
              </div>
            ))}
          </div>
          {/* Task list skeleton */}
          <div className="bg-white/50 rounded-2xl p-5 space-y-3 animate-pulse">
            <div className="w-36 h-4 rounded-full bg-[#3E435D]/15" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="w-5 h-5 rounded-full bg-[#CBC3A5]/40 shrink-0" />
                <div className="flex-1 h-3 rounded-full bg-[#CBC3A5]/40" style={{ width: `${70 - i * 10}%` }} />
                <div className="w-14 h-3 rounded-full bg-[#CBC3A5]/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#D3D0BC] to-[#D3D0BC]/90">

      {/* POP-UP OVERLAY FOR MEDICATION SELECTOR */}
      <AnimatePresence>
        {pendingMedsData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-[#3E435D]/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md"
            >
              <MedicationSelector
                extractedData={pendingMedsData}
                onComplete={() => {
                  setPendingMedsData(null); // Hide the popup
                  navigate("/pharmacy"); // Automatically send them to the pharmacy page
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVBAR */}
      <header ref={headerRef} className={`fixed top-0 left-0 right-0 z-50 bg-[#3E435D]/95 backdrop-blur-md border-b border-white/5 transition-all duration-300 ${isNavVisible ? "translate-y-0" : "-translate-y-full"}`}>
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
                <Link to="/surgery-readiness" className="px-3 py-1.5 rounded-lg text-[#D3D0BC]/70 text-sm font-medium hover:bg-[#CBC3A5]/10 transition-colors">Readiness</Link>
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

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="fixed left-0 right-0 bg-[#3E435D]/95 backdrop-blur-md z-40 border-b border-white/5 md:hidden" style={{ top: headerRef.current ? headerRef.current.offsetHeight + 'px' : '80px' }}>
            <div className="px-5 py-3 space-y-1">
              {[
                { to: "/dashboard", icon: Home, label: "Dashboard" },
                { to: "/chat", icon: MessageCircle, label: "AI Chat" },
                { to: "/surgery-readiness", icon: ShieldCheck, label: "Readiness" },
                { to: "/pharmacy", icon: Pill, label: "Pharmacy" },
              ].map(item => (
                <Link key={item.to} to={item.to} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <item.icon className="w-5 h-5 text-[#CBC3A5]" />
                  <span className="text-[#D3D0BC] text-sm font-medium">{item.label}</span>
                </Link>
              ))}
              <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors w-full">
                <LogOut className="w-5 h-5 text-[#CBC3A5]" />
                <span className="text-[#D3D0BC] text-sm font-medium">Logout</span>
              </button>
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
              <Wrapper key={item.label} {...wrapperProps} className="group bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-2.5 border border-[#3E435D]/5 hover:bg-white hover:shadow-lg hover:shadow-[#3E435D]/5 transition-all duration-300 hover:-translate-y-0.5">
                <div className={`${item.color} w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-5 h-5 text-[#CBC3A5]" />
                </div>
                <span className="text-[#3E435D] font-medium text-sm">{item.label}</span>
              </Wrapper>
            );
          })}
        </motion.div>

        {/* AI Agent Workflow Report */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn}>
          <AgentReportCard />
        </motion.div>

        {/* Recovery Tasks */}
        <motion.section
          id="timeline"
          className="scroll-mt-28"
          initial="hidden"
          animate="visible"
          variants={fadeIn}
        >
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[#3E435D] text-xl font-bold tracking-tight">
              Recovery Tasks
            </h2>
            {totalTasks > 0 && (
              <span className="text-[#9AA7B1] text-sm font-medium">
                {completedTasks}/{totalTasks} done
              </span>
            )}
          </div>

          {/* Overdue critical alert banner */}
          {hasOverdueCritical && viewDate === todayStr && (
            <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                One or more critical tasks are overdue by 2+ hours. Please complete them immediately.
              </p>
            </div>
          )}

          {/* Date navigator */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i - 2); // show 2 days back, today, 4 days forward
              const dStr = d.toISOString().slice(0, 10);
              const isToday = dStr === todayStr;
              const isSelected = dStr === viewDate;
              const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' });
              const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              return (
                <button
                  key={dStr}
                  onClick={() => setViewDate(dStr)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all ${
                    isSelected
                      ? 'bg-[#3E435D] border-[#3E435D] text-[#D3D0BC]'
                      : 'bg-white/80 border-[#3E435D]/10 text-[#9AA7B1] hover:border-[#3E435D]/30'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide">{dayLabel}</span>
                  <span className={isSelected ? 'text-[#D3D0BC]' : 'text-[#3E435D]'}>{dateLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Task list */}
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
                    onClick={() => viewDate === todayStr ? toggleTaskStatus(task.id) : null}
                    className={`group bg-white/80 backdrop-blur-sm rounded-xl p-4 border-l-[3px] transition-all duration-200
                      ${viewDate === todayStr ? 'cursor-pointer hover:bg-white hover:shadow-md' : 'cursor-default opacity-80'}
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
                          <h3 className={`font-medium text-sm truncate ${
                            task.status === 'completed' ? 'text-[#9AA7B1] line-through' : 'text-[#3E435D]'
                          }`}>
                            {task.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[#9AA7B1] text-xs">{task.time}</p>
                            {task.is_critical === 1 && task.status !== 'completed' && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                isOverdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {isOverdue ? 'OVERDUE' : 'CRITICAL'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-lg text-xs font-medium shrink-0 ${
                        task.status === 'completed'
                          ? 'bg-[#9AA7B1]/15 text-[#9AA7B1]'
                          : isOverdue
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[#CBC3A5]/20 text-[#3E435D]'
                      }`}>
                        {task.status === 'completed' ? 'Done' : isOverdue ? 'Overdue' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
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
                {loadingRecord ? <><span className="w-4 h-4 border-2 border-[#D3D0BC]/30 border-t-[#D3D0BC] rounded-full animate-spin" /> Processing...</> : <><Upload className="w-4 h-4" /> Upload & Digitize</>}
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

        {/* Wound Check & Results */}
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
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(woundSeverity.score / 10) * 100}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-2 rounded-full ${woundSeverity.barColor}`} />
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
              <Wrapper key={item.label} {...wrapperProps} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${item.active ? 'text-[#3E435D]' : 'text-[#9AA7B1] hover:text-[#3E435D]'}`}>
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

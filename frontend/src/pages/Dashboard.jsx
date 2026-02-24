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
  Home,
} from "lucide-react";
import { Progress } from "../components/ui/Progress";
import Vision from "../Vision";
import axios from "axios";
import { useState } from "react";
const API_BASE = "http://localhost:8000";


export default function Dashboard() {
  const [digitizedData, setDigitizedData] = useState(null);
const [loadingRecord, setLoadingRecord] = useState(false);
  const recoveryData = {
    patientName: "Margaret Johnson",
    surgeryType: "Hip Replacement",
    recoveryDay: 8,
    totalDays: 90,
    progress: 9,
  };
const handleDischargeUpload = async (file) => {
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    setLoadingRecord(true);
    const res = await axios.post(
      `${API_BASE}/api/digitize-record`,
      formData
    );
    setDigitizedData(res.data.data);
  } catch (err) {
    console.error("Digitization failed", err);
  } finally {
    setLoadingRecord(false);
  }
};
  const timelineTasks = [
    { id: 1, title: "Morning Medication", time: "8:00 AM", status: "completed", type: "medication" },
    { id: 2, title: "Wound Care & Cleaning", time: "9:30 AM", status: "completed", type: "wound" },
    { id: 3, title: "Physical Therapy Exercises", time: "2:00 PM", status: "pending", type: "exercise" },
    { id: 4, title: "Evening Medication", time: "6:00 PM", status: "pending", type: "medication" },
    { id: 5, title: "Temperature Check", time: "8:00 PM", status: "alert", type: "vital" },
  ];

const dischargeInfo = digitizedData
  ? [
      { label: "Procedure", value: digitizedData.procedure || "—" },
      { label: "Follow-up Date", value: digitizedData.follow_up_date || "—" },
      { label: "Doctor", value: digitizedData.doctor || "—" },
      {
        label: "Medications",
        value: `${digitizedData.medications?.length || 0} prescriptions`,
      },
    ]
  : [];
  const medications = [
    { name: "Acetaminophen 500mg", dosage: "2 tablets every 6 hours", refillDue: "3 days", status: "low" },
    { name: "Antibiotic (Cephalexin)", dosage: "1 capsule twice daily", refillDue: "7 days", status: "normal" },
    { name: "Blood Thinner (Apixaban)", dosage: "1 tablet daily", refillDue: "15 days", status: "normal" },
  ];

  return (
    <div className="min-h-screen bg-[#D3D0BC]">
      {/* Top Header */}
      <header className="bg-[#3E435D] px-4 py-6 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Heart className="w-8 h-8 text-[#CBC3A5]" />
              </Link>
              <div>
                <h1 className="text-[#D3D0BC] text-xl font-semibold">{recoveryData.patientName}</h1>
                <p className="text-[#9AA7B1] text-sm">{recoveryData.surgeryType}</p>
              </div>
            </div>
            <button className="text-[#D3D0BC]">
              <Menu className="w-7 h-7" />
            </button>
          </div>

          {/* Recovery Day Counter */}
          <div className="bg-[#CBC3A5] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#3E435D] font-semibold">Recovery Progress</span>
              <span className="text-[#3E435D] font-semibold">
                Day {recoveryData.recoveryDay} of {recoveryData.totalDays}
              </span>
            </div>
            <Progress value={recoveryData.progress} className="h-3 bg-[#D3D0BC]" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="#timeline" className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
            <Calendar className="w-8 h-8 text-[#3E435D]" />
            <span className="text-[#3E435D] font-medium text-center">Timeline</span>
          </a>
          <a href="#wound" className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
            <Camera className="w-8 h-8 text-[#3E435D]" />
            <span className="text-[#3E435D] font-medium text-center">Wound Check</span>
          </a>
          <Link to="/chat" className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
            <MessageCircle className="w-8 h-8 text-[#3E435D]" />
            <span className="text-[#3E435D] font-medium text-center">AI Chat</span>
          </Link>
          <Link to="/pharmacy" className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow">
            <Pill className="w-8 h-8 text-[#3E435D]" />
            <span className="text-[#3E435D] font-medium text-center">Pharmacy</span>
          </Link>
        </div>

        {/* Recovery Timeline Cards */}
        <section id="timeline" className="scroll-mt-20">
          <h2 className="text-[#3E435D] text-2xl font-semibold mb-4">Today's Recovery Tasks</h2>
          <div className="space-y-3">
            {timelineTasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
                  task.status === "completed"
                    ? "border-[#9AA7B1]"
                    : task.status === "alert"
                    ? "border-[#d4183d]"
                    : "border-[#CBC3A5]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {task.status === "completed" ? (
                      <CheckCircle className="w-6 h-6 text-[#9AA7B1] shrink-0" />
                    ) : task.status === "alert" ? (
                      <AlertCircle className="w-6 h-6 text-[#d4183d] shrink-0" />
                    ) : (
                      <Clock className="w-6 h-6 text-[#CBC3A5] shrink-0" />
                    )}
                    <div>
                      <h3 className="text-[#3E435D] font-semibold">{task.title}</h3>
                      <p className="text-[#9AA7B1]">{task.time}</p>
                    </div>
                  </div>
                  {task.status === "pending" && (
                    <div className="bg-[#CBC3A5] text-[#3E435D] px-4 py-2 rounded-xl text-sm font-medium">
                      Pending
                    </div>
                  )}
                  {task.status === "completed" && (
                    <div className="bg-[#9AA7B1] text-white px-4 py-2 rounded-xl text-sm font-medium">
                      Done
                    </div>
                  )}
                  {task.status === "alert" && (
                    <div className="bg-[#d4183d] text-white px-4 py-2 rounded-xl text-sm font-medium">
                      Review
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Digitized Discharge Summary */}
      <section className="bg-white rounded-2xl p-6 shadow-sm">
  <div className="flex items-center gap-2 mb-4">
    <FileText className="w-6 h-6 text-[#3E435D]" />
    <h2 className="text-[#3E435D] text-2xl font-semibold">
      Discharge Summary
    </h2>
  </div>

  {!digitizedData && (
    <div className="border-2 border-dashed border-[#CBC3A5] rounded-xl p-6 text-center">
      <p className="text-[#3E435D] font-medium mb-2">
        Upload Discharge Summary (PDF)
      </p>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        id="discharge-upload"
        onChange={(e) => handleDischargeUpload(e.target.files[0])}
      />
      <label
        htmlFor="discharge-upload"
        className="inline-block mt-2 bg-[#3E435D] text-[#D3D0BC] px-6 py-2 rounded-xl cursor-pointer hover:opacity-90"
      >
        {loadingRecord ? "Processing..." : "Upload & Digitize"}
      </label>
    </div>
  )}

  {digitizedData && (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {dischargeInfo.map((item, index) => (
          <div key={index} className="border-b border-[#CBC3A5] pb-3">
            <p className="text-[#9AA7B1] text-sm mb-1">{item.label}</p>
            <p className="text-[#3E435D] font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <button className="mt-4 text-[#3E435D] font-medium flex items-center gap-1 hover:gap-2 transition-all">
        AI-Parsed from Discharge PDF <ChevronRight className="w-5 h-5" />
      </button>
    </>
  )}
</section>

        {/* Wound Analysis Section */}
        <section id="wound" className="scroll-mt-20">
          <Vision />
        </section>

        {/* Medications Preview */}
        <section className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pill className="w-6 h-6 text-[#3E435D]" />
              <h2 className="text-[#3E435D] text-2xl font-semibold">Medications</h2>
            </div>
            <Link
              to="/pharmacy"
              className="text-[#3E435D] font-medium flex items-center gap-1 hover:gap-2 transition-all"
            >
              View All <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="space-y-3">
            {medications.slice(0, 2).map((med, index) => (
              <div key={index} className="border-l-4 border-[#CBC3A5] pl-4 py-2">
                <h3 className="text-[#3E435D] font-semibold">{med.name}</h3>
                <p className="text-[#9AA7B1] text-sm">{med.dosage}</p>
                {med.status === "low" && (
                  <div className="mt-2 bg-[#CBC3A5] text-[#3E435D] px-3 py-1 rounded-lg text-sm inline-block font-medium">
                    Refill due in {med.refillDue}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* AI Chat CTA */}
        <Link
          to="/chat"
          className="block bg-[#3E435D] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#CBC3A5] w-12 h-12 rounded-2xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#3E435D]" />
              </div>
              <div>
                <h3 className="text-[#D3D0BC] font-semibold text-lg">Need Help?</h3>
                <p className="text-[#9AA7B1]">Chat with AI Recovery Assistant</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-[#D3D0BC]" />
          </div>
        </Link>
      </div>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 bg-white border-t border-[#3E435D]/20 px-4 py-3 mt-6">
        <div className="max-w-7xl mx-auto flex items-center justify-around">
          <Link to="/dashboard" className="flex flex-col items-center gap-1 text-[#3E435D]">
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/chat" className="flex flex-col items-center gap-1 text-[#9AA7B1]">
            <MessageCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Chat</span>
          </Link>
          <a href="#wound" className="flex flex-col items-center gap-1 text-[#9AA7B1]">
            <Activity className="w-6 h-6" />
            <span className="text-xs font-medium">Health</span>
          </a>
          <Link to="/pharmacy" className="flex flex-col items-center gap-1 text-[#9AA7B1]">
            <Pill className="w-6 h-6" />
            <span className="text-xs font-medium">Meds</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

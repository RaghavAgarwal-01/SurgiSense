import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, ChevronLeft, Pill, AlertCircle, Clock, CheckCircle, Package, MapPin, Phone } from "lucide-react";
import { Progress } from "../components/ui/Progress";
import { motion } from "framer-motion";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Pharmacy() {
  const [medications, setMedications] = useState([]);
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('surgisense_active_meds');
    if (saved) {
      try {
        const parsedMeds = JSON.parse(saved);
        if (parsedMeds && parsedMeds.length > 0) {
          setMedications(parsedMeds);
        } else {
          setHasData(false);
        }
      } catch (e) {
        setHasData(false);
      }
    } else {
      setHasData(false);
    }
  }, []);

  const orderHistory = [
    { date: "Feb 10, 2026", medication: "Acetaminophen 500mg", status: "Delivered" },
    { date: "Feb 7, 2026", medication: "All Post-Surgery Medications", status: "Delivered" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D3D0BC] to-[#D3D0BC]/90">
      {/* Header */}
      <header className="bg-[#3E435D]/95 backdrop-blur-md px-5 py-3 sticky top-0 z-10 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/dashboard" className="text-[#D3D0BC] hover:bg-white/10 p-1.5 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-[#CBC3A5] rounded-xl flex items-center justify-center">
            <Pill className="w-5 h-5 text-[#3E435D]" />
          </div>
          <div>
            <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">Pharmacy & Medications</h1>
            <p className="text-[#9AA7B1] text-xs">Manage your prescriptions</p>
          </div>
        </div>
      </header>

      <motion.div initial="hidden" animate="visible" variants={fadeIn} className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        {/* Active Medications */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#3E435D] text-xl font-bold tracking-tight">Active Medications</h2>
            <span className="bg-[#CBC3A5]/30 text-[#3E435D] px-3 py-1 rounded-full text-xs font-semibold">
              {medications.length} active
            </span>
          </div>

          {!hasData ? (
            <div className="text-center py-12 border-2 border-dashed border-[#CBC3A5]/30 rounded-2xl bg-white/60 backdrop-blur-sm">
              <Pill className="w-10 h-10 text-[#9AA7B1] mx-auto mb-3" />
              <p className="text-[#3E435D] font-semibold text-sm mb-1">No Medications Found</p>
              <p className="text-[#9AA7B1] text-xs mb-4">Upload a discharge summary first to see your medications.</p>
              <Link to="/dashboard" className="inline-block bg-[#3E435D] text-[#D3D0BC] px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#4a5070] transition-colors shadow-md shadow-[#3E435D]/15">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {medications.map((med, index) => (
                <div key={med.id || index} className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-[#3E435D]/5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-[#3E435D] text-base font-bold mb-0.5">{med.name || med.medication_name || "Prescription"}</h3>
                      <p className="text-[#9AA7B1] text-sm">{med.dosage || med.instructions || "Take as directed"}</p>
                    </div>
                    {med.status === "low" && (
                      <span className="bg-[#CBC3A5]/20 text-[#3E435D] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Low
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#9AA7B1]">Supply Remaining</span>
                      <span className="text-[#3E435D] font-semibold">{med.daysRemaining || "14"} days</span>
                    </div>
                    <Progress value={med.progress || 100} className={`h-1.5 ${med.status === 'low' ? 'bg-[#CBC3A5]/30' : ''}`} />
                  </div>

                  <div className="bg-[#D3D0BC]/15 rounded-xl p-3 mb-3 flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#3E435D]" />
                    <div>
                      <p className="text-[#9AA7B1] text-[11px]">Next Dose</p>
                      <p className="text-[#3E435D] font-semibold text-sm">{med.nextDose || "As directed"}</p>
                    </div>
                  </div>

                  <div className="border-t border-[#3E435D]/5 pt-3 mb-3">
                    <p className="text-[#3E435D] text-xs">
                      <span className="font-semibold">Instructions:</span> {med.instructions || med.dosage || "Follow doctor's instructions."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#9AA7B1]">
                      Refills: <span className="text-[#3E435D] font-semibold">{med.refillsLeft || 0}</span>
                    </p>
                    {med.status === "low" && (
                      <button className="bg-[#3E435D] text-[#D3D0BC] px-4 py-2 rounded-xl font-semibold text-xs hover:bg-[#4a5070] transition-colors shadow-sm">
                        Order Refill
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pharmacy Info */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-[#3E435D]/5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-[#CBC3A5]" />
            </div>
            <h2 className="text-[#3E435D] text-base font-bold">Your Pharmacy</h2>
          </div>
          <div className="bg-[#D3D0BC]/10 rounded-xl p-4 mb-3">
            <h3 className="text-[#3E435D] font-semibold text-sm">CVS Pharmacy #4521</h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#9AA7B1]" />
              <p className="text-[#9AA7B1] text-xs">2847 Oak Street, Suite 100, Springfield, IL 62701</p>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5 text-[#9AA7B1]" />
              <p className="text-[#3E435D] font-medium text-xs">(555) 123-4567</p>
            </div>
          </div>
          <button className="w-full border-2 border-[#3E435D]/15 text-[#3E435D] py-2.5 rounded-xl font-semibold text-sm hover:bg-[#3E435D] hover:text-[#D3D0BC] transition-all duration-200">
            Change Pharmacy
          </button>
        </section>

        {/* Order History */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-[#3E435D]/5">
          <h2 className="text-[#3E435D] text-base font-bold mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {orderHistory.map((order, index) => (
              <div key={index} className="flex items-center justify-between pb-3 border-b border-[#3E435D]/5 last:border-0 last:pb-0">
                <div>
                  <p className="text-[#3E435D] font-semibold text-sm">{order.medication}</p>
                  <p className="text-[#9AA7B1] text-xs">{order.date}</p>
                </div>
                <span className="flex items-center gap-1.5 bg-[#9AA7B1]/10 text-[#9AA7B1] px-2.5 py-1 rounded-lg text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> {order.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Safety Information */}
        <section className="bg-[#3E435D] rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#CBC3A5] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[#D3D0BC] font-semibold text-sm mb-2">Medication Safety</h3>
              <ul className="space-y-1.5 text-[#9AA7B1] text-xs">
                {[
                  "Never skip doses without consulting your doctor",
                  "Report any side effects immediately",
                  "Keep medications in original containers",
                  "Store in a cool, dry place away from children",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-[#CBC3A5] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Emergency Contact */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border-2 border-[#3E435D]/10">
          <h3 className="text-[#3E435D] font-bold text-sm mb-2">Medication Emergency?</h3>
          <p className="text-[#9AA7B1] text-xs mb-3">
            If you experience severe side effects or have taken an incorrect dose:
          </p>
          <div className="space-y-2">
            <a href="tel:911" className="block bg-[#d4183d] text-white py-2.5 rounded-xl font-semibold text-sm text-center hover:bg-[#b01530] transition-colors shadow-sm">
              Emergency: 911
            </a>
            <a href="tel:18002221222" className="block bg-[#3E435D] text-[#D3D0BC] py-2.5 rounded-xl font-semibold text-sm text-center hover:bg-[#4a5070] transition-colors">
              Poison Control: 1-800-222-1222
            </a>
          </div>
        </section>
      </motion.div>
    </div>
  );
}

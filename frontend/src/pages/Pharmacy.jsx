import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Pill, AlertCircle, Clock, CheckCircle, Package, MapPin, Navigation, Loader2, Plus, Minus, ShoppingCart, ExternalLink, X } from "lucide-react";
import { Progress } from "../components/ui/Progress";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

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

export default function Pharmacy() {
  const navigate = useNavigate();
  const [medications, setMedications] = useState([]);

  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", type: "Tablet", totalQuantity: "", doseAmount: "1" });

  const [reorderItem, setReorderItem] = useState(null);
  const [isSearchingPrices, setIsSearchingPrices] = useState(false);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── DB-FIRST MEDICATION FETCH ───────────────────────────────────────────
  const loadMedications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/my-medicines`, getAuthHeaders());
      
      if (res.data?.status === "success" && res.data.data?.length > 0) {
        const dbMeds = res.data.data.map((m) => ({
          id: m.id || Math.random().toString(36).substr(2, 9),
          name: m.name,
          medication_name: m.name,
          dosage: m.dosage || "Take as directed",
          frequency: m.frequency,
          totalQuantity: m.total_quantity || 30,
          currentQuantity: m.current_quantity ?? 30,
          doseAmount: m.dose_amount || 1,
          type: m.type || "Tablet",
          ...m,
        }));
        setMedications(dbMeds);
        localStorage.setItem('surgisense_active_meds', JSON.stringify(dbMeds));
      }
    } catch (err) {
      console.error("Failed to load medicines from DB, falling back to localStorage:", err);
      // Fallback to local storage if DB is unreachable
      const saved = localStorage.getItem('surgisense_active_meds');
      if (saved) {
        try {
          const parsedMeds = JSON.parse(saved);
          setMedications(parsedMeds);
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    loadMedications();
    findNearby();
  }, [loadMedications]);

  const findNearby = () => {
    setLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await axios.get(
            `${API_BASE}/api/pharmacies/nearest?lat=${latitude}&lng=${longitude}`
          );
          setNearbyPharmacies(res.data);
        } catch (err) {
          setLocationError("Could not connect to the pharmacy database.");
        } finally {
          setLoadingLocation(false);
        }
      },
      (error) => {
        setLocationError("Location access denied. Please allow location permissions in your browser URL bar.");
        setLoadingLocation(false);
      }
    );
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!newMed.name || !newMed.totalQuantity) return;

    const targetMed = medications.find(m => (m.name || m.medication_name) === newMed.name);
    if (!targetMed) return;

    try {
      await axios.patch(`${API_BASE}/api/medicines/${targetMed.id}`, {
        total_quantity: Number(newMed.totalQuantity),
        dose_amount: Number(newMed.doseAmount)
      }, getAuthHeaders());
      
      setShowAddForm(false);
      setNewMed({ name: "", type: "Tablet", totalQuantity: "", doseAmount: "1" });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 1200);
      
      loadMedications();
    } catch (err) {
      console.error("Failed to update medication:", err);
    }
  };

  // ── REAL-TIME DB INVENTORY DEDUCTION ────────────────────────────────────
  const takeDose = async (med) => {
    // 1. Optimistic UI update (makes it feel instant)
    setMedications(prevMeds => prevMeds.map(m => {
      if (m.id === med.id) {
        const remaining = Math.max(0, m.currentQuantity - (m.doseAmount || 1));
        return { ...m, currentQuantity: remaining };
      }
      return m;
    }));

    // 2. Background Database Sync
    try {
      const medName = med.name || med.medication_name;
      await axios.post(`${API_BASE}/api/inventory/deduct`, {
        medicine_name: medName
      }, getAuthHeaders());
      console.log(`✅ Dose deducted in DB for ${medName}`);
    } catch (err) {
      console.error("Failed to sync dose deduction with DB:", err);
      // Revert optimistic update on failure
      loadMedications();
    }
  };

  const handleReorderClick = async (med) => {
    setReorderItem(med);
    setIsSearchingPrices(true);

    try {
      const medName = med.name || med.medication_name;
      const res = await axios.get(
        `${API_BASE}/api/pharmacy/search-prices?medicine=${encodeURIComponent(medName)}`
      );

      if (res.data && res.data.vendors) {
        setVendorOptions(res.data.vendors);
      } else {
        setVendorOptions([]);
      }
    } catch (error) {
      console.error("Agent failed to fetch real-time prices:", error);
      setVendorOptions([
        { vendor: "Error fetching data", price: "N/A", delivery: "Try again later", url: "#" }
      ]);
    } finally {
      setIsSearchingPrices(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D3D0BC] to-[#D3D0BC]/90 pb-10">
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

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#3E435D] text-xl font-bold tracking-tight">Active Medications</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#3E435D] text-[#D3D0BC] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 hover:bg-[#4a5070] transition-colors"
            >
              <Plus className="w-4 h-4" /> Track Med
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-[#3E435D]/10 shadow-sm">
              <h3 className="text-[#3E435D] font-bold text-sm mb-3">Set Up Inventory Tracking</h3>
              <form onSubmit={handleAddMedication} className="space-y-3">
                <div className="relative">
                  <select
                    required
                    value={newMed.name}
                    onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                    className="w-full appearance-none bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-[#3E435D] outline-none focus:border-[#3E435D]/50 transition-colors cursor-pointer"
                  >
                    <option value="" disabled>Select Medicine from Report...</option>
                    {(!medications || medications.length === 0) ? (
                      <option value="" disabled>Loading medicines...</option>
                    ) : (
                      medications.map((med, idx) => {
                        const mName = med.name || med.medication_name;
                        return <option key={idx} value={mName}>{mName}</option>;
                      })
                    )}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3E435D]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <select
                      value={newMed.type} onChange={(e) => setNewMed({ ...newMed, type: e.target.value })}
                      className="w-full appearance-none bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2.5 pr-10 text-sm text-[#3E435D] outline-none cursor-pointer"
                    >
                      <option value="Tablet">Tablets / Pills</option>
                      <option value="ml">Syrup (ml)</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3E435D]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <input
                    type="number" placeholder={`Total ${newMed.type === 'Tablet' ? 'Pills' : 'ml'} Bought`} required min="1"
                    value={newMed.totalQuantity} onChange={(e) => setNewMed({ ...newMed, totalQuantity: e.target.value })}
                    className="flex-1 bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2.5 text-sm text-[#3E435D] outline-none"
                  />
                </div>
                <div className="relative flex items-center bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 overflow-hidden">
                  <span className="text-sm text-[#596079] whitespace-nowrap border-r border-[#3E435D]/10 pr-3 mr-3 py-2.5">Amount per dose</span>
                  <input
                    type="number" required min="1"
                    value={newMed.doseAmount} onChange={(e) => setNewMed({ ...newMed, doseAmount: e.target.value })}
                    className="w-full bg-transparent py-2.5 text-sm text-[#3E435D] outline-none"
                  />
                </div>
                <button type="submit" className="w-full bg-[#CBC3A5] text-[#3E435D] font-bold py-2.5 rounded-xl mt-2 hover:bg-[#b5ad90] transition-colors">
                  Save to Inventory
                </button>
              </form>
            </div>
          )}

          {medications.length === 0 && !showAddForm ? (
            <div className="text-center py-12 border-2 border-dashed border-[#CBC3A5]/30 rounded-2xl bg-white/60 backdrop-blur-sm">
              <Pill className="w-10 h-10 text-[#9AA7B1] mx-auto mb-3" />
              <p className="text-[#3E435D] font-semibold text-sm mb-1">No Medications Found</p>
              <p className="text-[#9AA7B1] text-xs mb-4">Upload a discharge summary first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {medications.map((med) => {
                const medName = med.name || med.medication_name;
                const isTracked = med.currentQuantity > 0;
                const percentLeft = isTracked ? (med.currentQuantity / med.totalQuantity) * 100 : 0;
                const isLow = isTracked && percentLeft <= 20;

                return (
                  <div key={med.id} className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 border ${isLow ? 'border-red-400/50' : 'border-[#3E435D]/5'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-[#3E435D] text-base font-bold mb-0.5">{medName}</h3>
                        {isTracked ? (
                          <p className="text-[#9AA7B1] text-sm">
                            {med.currentQuantity} / {med.totalQuantity} {med.type || 'Tablet'}s remaining
                          </p>
                        ) : (
                          <p className="text-[#9AA7B1] text-sm">{med.dosage || "Inventory not setup"}</p>
                        )}
                      </div>

                      {isLow && (
                        <div className="flex flex-col items-end gap-2">
                          <span className="bg-red-100 text-red-600 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Low Supply
                          </span>
                          <button
                            onClick={() => handleReorderClick(med)}
                            className="bg-[#3E435D] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#4a5070] transition-colors flex items-center gap-1.5 shadow-sm animate-pulse"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" /> Reorder
                          </button>
                        </div>
                      )}
                    </div>

                    {isTracked ? (
                      <>
                        <Progress value={percentLeft} className={`h-1.5 mb-4 ${isLow ? 'bg-red-200' : ''}`} />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => takeDose(med)}
                            disabled={med.currentQuantity <= 0}
                            className="flex-1 bg-[#D3D0BC]/30 text-[#3E435D] py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#D3D0BC]/60 transition-colors disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4" /> Take Dose ({med.doseAmount || 1} {med.type === 'Tablet' ? 'pill' : 'ml'})
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 flex items-center justify-between bg-[#D3D0BC]/20 p-3 rounded-xl">
                        <span className="text-xs text-[#596079]">Setup tracking to monitor supply</span>
                        <button
                          onClick={() => {
                            setNewMed({ ...newMed, name: medName });
                            setShowAddForm(true);
                          }}
                          className="text-xs font-bold text-[#3E435D] hover:underline"
                        >
                          Setup
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-[#3E435D]/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-[#CBC3A5]" />
              </div>
              <h2 className="text-[#3E435D] text-base font-bold">Nearby Pharmacies</h2>
            </div>

            <button
              onClick={findNearby}
              disabled={loadingLocation}
              className="bg-[#3E435D] text-[#D3D0BC] px-4 py-2 rounded-xl font-semibold text-sm hover:bg-[#4a5070] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
            >
              {loadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {loadingLocation ? "Locating..." : "Find Nearest"}
            </button>
          </div>

          {locationError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{locationError}</p>
            </div>
          )}

          <div className="space-y-3">
            {nearbyPharmacies.length > 0 ? (
              nearbyPharmacies.map((pharm, idx) => (
                <div key={idx} className="bg-[#D3D0BC]/10 rounded-xl p-4 flex justify-between items-center border border-[#3E435D]/5">
                  <div className="flex-1 pr-4">
                    <h3 className="text-[#3E435D] font-bold text-sm mb-1">{pharm.name}</h3>
                    <div className="flex items-start gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#9AA7B1] shrink-0 mt-0.5" />
                      <p className="text-[#596079] text-xs leading-snug">{pharm.address}</p>
                    </div>
                    <p className="text-[#3E435D] font-bold text-xs mt-2 bg-[#CBC3A5]/30 inline-block px-2 py-1 rounded-md">
                      {pharm.distance_km} km away
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(`http://googleusercontent.com/maps.google.com/?q=${encodeURIComponent(pharm.name + ' ' + pharm.address)}`, '_blank')}
                    className="p-3 bg-[#3E435D] text-[#D3D0BC] rounded-xl hover:bg-[#4a5070] transition-colors shadow-sm shrink-0"
                  >
                    <Navigation className="w-5 h-5" />
                  </button>
                </div>
              ))
            ) : (
              !loadingLocation && !locationError && (
                <p className="text-[#9AA7B1] text-sm italic text-center py-6 border-2 border-dashed border-[#CBC3A5]/30 rounded-xl">
                  Click the button to scan for pharmacies near your location.
                </p>
              )
            )}
          </div>
        </section>

      </motion.div>

      {/* Success toast */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#3E435D] text-[#D3D0BC] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold"
          >
            <CheckCircle className="w-5 h-5 text-green-400" />
            Inventory saved!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reorderItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E435D]/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-[#3E435D] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#CBC3A5]" />
                  <h3 className="text-[#D3D0BC] font-bold text-lg">Restock Medicine</h3>
                </div>
                <button
                  onClick={() => setReorderItem(null)}
                  className="text-[#D3D0BC] hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-5 text-center">
                  <p className="text-[#9AA7B1] text-xs font-semibold uppercase tracking-wider mb-1">Searching best prices for</p>
                  <h2 className="text-[#3E435D] text-xl font-bold">{reorderItem.name || reorderItem.medication_name}</h2>
                </div>

                {isSearchingPrices ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3 border-2 border-dashed border-[#CBC3A5]/30 rounded-2xl bg-[#D3D0BC]/10">
                    <Loader2 className="w-8 h-8 text-[#3E435D] animate-spin" />
                    <p className="text-[#596079] text-sm font-medium">Agent scanning pharmacy APIs...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vendorOptions.map((option, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-[#CBC3A5]/50 bg-[#D3D0BC]/10 hover:bg-[#D3D0BC]/20 transition-colors">
                        <div className="flex-1 pr-3">
                          <h4 className="text-[#3E435D] font-bold text-sm truncate">{option.vendor}</h4>
                          <p className="text-green-600 font-extrabold text-lg leading-tight">{option.price}</p>
                          <p className="text-[#9AA7B1] text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {option.delivery}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            window.open(option.url, '_blank');
                            setReorderItem(null);
                          }}
                          className="bg-[#CBC3A5] text-[#3E435D] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#b5ad90] transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          Buy <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setReorderItem(null)}
                  className="w-full mt-5 py-2.5 text-[#596079] font-semibold text-sm hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
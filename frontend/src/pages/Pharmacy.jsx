import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Pill, AlertCircle, Clock, CheckCircle, Package, MapPin, Navigation, Loader2, Plus, Minus } from "lucide-react";
import { Progress } from "../components/ui/Progress"; 
import { motion } from "framer-motion";
import axios from "axios";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Pharmacy() {
  const [medications, setMedications] = useState([]);
  
  // Pharmacy API States
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Manual inventory tracking states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ name: "", type: "Tablet", totalQuantity: "", doseAmount: "1" });

  useEffect(() => {
    // Load medications from local storage (Extracted from the AI PDF)
    const saved = localStorage.getItem('surgisense_active_meds');
    if (saved) {
      try {
        const parsedMeds = JSON.parse(saved);
        if (parsedMeds && Array.isArray(parsedMeds) && parsedMeds.length > 0) {
          // Normalize medication objects to ensure they have required fields
          const initializedMeds = parsedMeds.map((m, idx) => ({
            id: m.id || Math.random().toString(36).substr(2, 9),
            // Support both 'name' and 'medication_name' properties
            name: m.name || m.medication_name || `Medication ${idx + 1}`,
            medication_name: m.medication_name || m.name || `Medication ${idx + 1}`,
            dosage: m.dosage || m.instructions || "Take as directed",
            ...m,
          }));
          setMedications(initializedMeds);
          console.log("Loaded medications:", initializedMeds);
        }
      } catch (e) {
        console.error("Failed to parse meds:", e);
      }
    }
    findNearby();
  }, []);

  // Save back to local storage whenever inventory updates
  useEffect(() => {
    if (medications.length > 0) {
      localStorage.setItem('surgisense_active_meds', JSON.stringify(medications));
    }
  }, [medications]);

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
            `http://localhost:8000/api/pharmacies/nearest?lat=${latitude}&lng=${longitude}`
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

  // --- INVENTORY TRACKING LOGIC --- //

  const handleAddMedication = (e) => {
    e.preventDefault();
    if (!newMed.name || !newMed.totalQuantity) return;

    // Find the medicine they selected from the dropdown and update its inventory
    const updatedMeds = medications.map(med => {
      const medName = med.name || med.medication_name;
      if (medName === newMed.name) {
        return {
          ...med,
          type: newMed.type,
          totalQuantity: Number(newMed.totalQuantity),
          currentQuantity: Number(newMed.totalQuantity),
          doseAmount: Number(newMed.doseAmount),
        };
      }
      return med;
    });

    setMedications(updatedMeds);
    setShowAddForm(false);
    setNewMed({ name: "", type: "Tablet", totalQuantity: "", doseAmount: "1" });
  };

  const takeDose = (id) => {
    setMedications(medications.map(med => {
      if (med.id === id) {
        const remaining = Math.max(0, med.currentQuantity - (med.doseAmount || 1));
        return { ...med, currentQuantity: remaining };
      }
      return med;
    }));
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#D3D0BC] to-[#D3D0BC]/90 pb-10">
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
        
        {/* Active Medications Section */}
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

          {/* Add Medication Form */}
          {showAddForm && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 mb-5 border border-[#3E435D]/10 shadow-sm">
              <h3 className="text-[#3E435D] font-bold text-sm mb-3">Set Up Inventory Tracking</h3>
              <form onSubmit={handleAddMedication} className="space-y-3">
                
                {/* THE NEW DROPDOWN MAPPED FROM THE AI REPORT */}
                <select 
                  required
                  value={newMed.name} 
                  onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                  className="w-full bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2 text-sm text-[#3E435D] outline-none focus:border-[#3E435D]/50"
                >
                  <option value="" disabled>Select Medicine from Report...</option>
                  {medications.map((med, idx) => {
                    const mName = med.name || med.medication_name;
                    return <option key={idx} value={mName}>{mName}</option>;
                  })}
                </select>

                <div className="flex gap-3">
                  <select 
                    value={newMed.type} onChange={(e) => setNewMed({...newMed, type: e.target.value})}
                    className="flex-1 bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2 text-sm text-[#3E435D] outline-none"
                  >
                    <option value="Tablet">Tablets / Pills</option>
                    <option value="ml">Syrup (ml)</option>
                  </select>
                  <input 
                    type="number" placeholder={`Total ${newMed.type === 'Tablet' ? 'Pills' : 'ml'} Bought`} required min="1"
                    value={newMed.totalQuantity} onChange={(e) => setNewMed({...newMed, totalQuantity: e.target.value})}
                    className="flex-1 bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2 text-sm text-[#3E435D] outline-none"
                  />
                </div>
                <input 
                  type="number" placeholder={`Amount per dose (e.g. 1 ${newMed.type === 'Tablet' ? 'pill' : 'ml'})`} required min="1"
                  value={newMed.doseAmount} onChange={(e) => setNewMed({...newMed, doseAmount: e.target.value})}
                  className="w-full bg-[#D3D0BC]/20 border border-[#3E435D]/10 rounded-xl px-3 py-2 text-sm text-[#3E435D] outline-none"
                />
                <button type="submit" className="w-full bg-[#CBC3A5] text-[#3E435D] font-bold py-2 rounded-xl mt-2 hover:bg-[#b5ad90] transition-colors">
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
                const isTracked = med.totalQuantity !== undefined;
                const percentLeft = isTracked ? (med.currentQuantity / med.totalQuantity) * 100 : 0;
                const isLow = isTracked && percentLeft <= 20;

                return (
                  <div key={med.id} className={`bg-white/80 backdrop-blur-sm rounded-2xl p-5 border ${isLow ? 'border-red-400/50' : 'border-[#3E435D]/5'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-[#3E435D] text-base font-bold mb-0.5">{medName}</h3>
                        {isTracked ? (
                          <p className="text-[#9AA7B1] text-sm">
                            {med.currentQuantity} / {med.totalQuantity} {med.type}s remaining
                          </p>
                        ) : (
                          <p className="text-[#9AA7B1] text-sm">{med.dosage || "Inventory not setup"}</p>
                        )}
                      </div>
                      {isLow && (
                        <span className="bg-red-100 text-red-600 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Low Supply
                        </span>
                      )}
                    </div>
                    
                    {isTracked ? (
                      <>
                        <Progress value={percentLeft} className={`h-1.5 mb-4 ${isLow ? 'bg-red-200' : ''}`} />
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => takeDose(med.id)}
                            disabled={med.currentQuantity <= 0}
                            className="flex-1 bg-[#D3D0BC]/30 text-[#3E435D] py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#D3D0BC]/60 transition-colors disabled:opacity-50"
                          >
                            <Minus className="w-4 h-4" /> Take Dose ({med.doseAmount} {med.type === 'Tablet' ? 'pill' : 'ml'})
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

        {/* NEAREST PHARMACIES (API Integrated) */}
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
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(pharm.name + ' ' + pharm.address)}`, '_blank')}
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
    </div>
  );
}
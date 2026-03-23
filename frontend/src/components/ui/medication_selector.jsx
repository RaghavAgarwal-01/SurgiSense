import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Pill, X } from "lucide-react";

export default function MedicationSelector({ extractedData, onComplete }) {
  const [availableMeds, setAvailableMeds] = useState([]);
  const [selectedMed, setSelectedMed] = useState("");
  const [medAmount, setMedAmount] = useState("");
  const [confirmedMeds, setConfirmedMeds] = useState([]);

  // THE SMART HUNTER: Finds medicines no matter how the AI formatted them
  useEffect(() => {
    if (!extractedData) {
      console.log("No extractedData provided to MedicationSelector");
      return;
    }

    console.log("=== MEDICATION SELECTOR MOUNT ===");
    console.log("extractedData received:", extractedData);

    let parsedData = extractedData;
    
    // 1. If Llama sent a raw text string (with Markdown), clean it and parse it!
    if (typeof extractedData === 'string') {
      try {
        const cleanString = extractedData.replace(/```json/gi, '').replace(/```/gi, '').trim();
        parsedData = JSON.parse(cleanString);
      } catch (error) {
        console.error("Could not parse AI string:", error);
        return;
      }
    }

    // 2. Search deeply for anything that looks like an array of medicines
    let foundMeds = [];
    
    const extractArray = (obj) => {
      if (foundMeds.length > 0) return; // Stop if we found it
      
      for (const key in obj) {
        if (Array.isArray(obj[key]) && obj[key].length > 0) {
          // Check if the array holds objects with medicine-like keywords
          const firstItem = obj[key][0];
          if (firstItem && (firstItem.name || firstItem.medication_name || firstItem.medication || firstItem.medicine || firstItem.dosage)) {
            foundMeds = obj[key];
            return;
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          extractArray(obj[key]); // Search deeper inside nested objects
        }
      }
    };

    // Try direct exact-matches first, then unleash the deep search
    if (parsedData.medication_list) foundMeds = parsedData.medication_list;
    else if (parsedData.medications) foundMeds = parsedData.medications;
    else if (parsedData.prescriptions) foundMeds = parsedData.prescriptions;
    else extractArray(parsedData);

    console.log("Extracted medications from report:", foundMeds);

    // Normalize the names so our dropdown always works
    const normalizedMeds = foundMeds.map((med, index) => {
      const name = med.name || med.medication_name || med.medication || med.medicine || `Unknown Prescription ${index + 1}`;
      return {
        ...med,
        id: med.id || `ai_med_${index}`,
        name: name,
        medication_name: name,
        dosage: med.dosage || med.frequency || "Take as directed"
      };
    });

    console.log("Normalized medications:", normalizedMeds);

    // DEDUPLICATE MEDICATIONS - if same name, only keep first one
    const seenNames = new Set();
    const deduplicatedMeds = normalizedMeds.filter(med => {
      if (seenNames.has(med.name)) {
        console.log(`Filtered duplicate: ${med.name}`);
        return false;
      }
      seenNames.add(med.name);
      return true;
    });

    console.log("Deduplicated medications:", deduplicatedMeds);

    setAvailableMeds(deduplicatedMeds);
    // DO NOT pre-populate confirmedMeds - let the user select from the dropdown
    // The dropdown needs availableMeds to show options
    
    if (deduplicatedMeds.length > 0) {
      console.log("✅ Medications ready for selection:", deduplicatedMeds);
    } else {
      console.warn("⚠️ NO MEDICATIONS FOUND! foundMeds was empty");
      console.warn("Parsed data was:", parsedData);
    }
  }, [extractedData]);

  const [selectedMedObject, setSelectedMedObject] = useState(null);

  const handleMedicationSelect = (medName) => {
    setSelectedMed(medName);
    // Find the medication object to get its details
    const med = availableMeds.find(m => m.name === medName);
    setSelectedMedObject(med);
    console.log("Selected medication details:", med);
  };

  const handleAddMedicine = () => {
    if (!selectedMed) {
      console.warn("No medication selected");
      return;
    }

    console.log("Adding medication:", selectedMed);

    // Get the full medication object from availableMeds to preserve ALL data
    const selectedMedFull = availableMeds.find(m => m.name === selectedMed);

    const newMedicine = {
      id: selectedMedFull?.id || Date.now(),
      name: selectedMed,
      medication_name: selectedMed,
      dosage: selectedMedFull?.dosage || "Take as directed",
      frequency: selectedMedFull?.frequency || "",
      duration: selectedMedFull?.duration || "",
      totalQuantity: medAmount ? parseFloat(medAmount.match(/\d+/)?.[0]) : undefined,
      currentQuantity: medAmount ? parseFloat(medAmount.match(/\d+/)?.[0]) : undefined,
      doseAmount: 1, // Will be set in Pharmacy page
      type: "Tablet" // Will be set in Pharmacy page
    };

    console.log("New medicine object:", newMedicine);

    setConfirmedMeds([...confirmedMeds, newMedicine]);
    
    // Remove from available meds
    setAvailableMeds(availableMeds.filter(med => med.name !== selectedMed));
    setSelectedMed("");
    setMedAmount("");
    setSelectedMedObject(null);
    
    console.log("✅ Medication added. ConfirmedMeds now:", [...confirmedMeds, newMedicine]);
  };

  const handleRemove = (idToRemove, medName) => {
    // Find the medicine that was removed to restore it to availableMeds
    const removedMed = confirmedMeds.find(m => m.id === idToRemove);
    setConfirmedMeds(confirmedMeds.filter(med => med.id !== idToRemove));
    
    // Restore to available meds
    if (removedMed) {
      setAvailableMeds([...availableMeds, removedMed]);
    }
  };

  // Auto-save to localStorage whenever confirmedMeds changes
  useEffect(() => {
    if (confirmedMeds.length > 0) {
      localStorage.setItem("surgisense_active_meds", JSON.stringify(confirmedMeds));
      console.log("Syncing confirmedMeds to localStorage:", confirmedMeds);
    }
  }, [confirmedMeds]);

  const handleSaveToPharmacy = () => {
    // Final verification - save the confirmed list
    localStorage.setItem("surgisense_active_meds", JSON.stringify(confirmedMeds));
    console.log("Final save to localStorage:", confirmedMeds);
    if (onComplete) onComplete();
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-[#3E435D]/10 max-w-md w-full mx-auto shadow-lg max-h-[90vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#3E435D] text-lg font-bold flex items-center gap-2">
          <Pill className="w-5 h-5" />
          Confirm Your Medications
        </h2>
        <button
          onClick={() => {
            if (onComplete) onComplete();
          }}
          className="text-[#9AA7B1] hover:text-[#3E435D] hover:bg-[#D3D0BC]/20 p-2 rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="overflow-y-auto flex-1 pr-2">
        <div className="space-y-3 mb-6 bg-[#D3D0BC]/20 p-4 rounded-xl">
          <div>
            <label className="text-xs font-semibold text-[#3E435D] mb-1 block">Select from Report</label>
            <select 
              className="w-full p-2.5 rounded-lg border border-[#CBC3A5] bg-white text-[#3E435D] text-sm focus:outline-none focus:ring-2 focus:ring-[#3E435D]/50"
              value={selectedMed}
              onChange={(e) => handleMedicationSelect(e.target.value)}
            >
              <option value="">-- Choose a medication --</option>
              {availableMeds.map((med, idx) => (
                <option key={idx} value={med.name}>
                  {med.name}
                </option>
              ))}
            </select>
          </div>

          {/* SHOW MEDICATION DETAILS IF SELECTED */}
          {selectedMedObject && (
            <div className="bg-[#CBC3A5]/20 p-3 rounded-lg border border-[#CBC3A5]/50">
              <p className="text-xs font-semibold text-[#3E435D] mb-2">📋 From Report:</p>
              {selectedMedObject.dosage && (
                <p className="text-sm text-[#3E435D] mb-1"><strong>Dosage:</strong> {selectedMedObject.dosage}</p>
              )}
              {selectedMedObject.frequency && (
                <p className="text-sm text-[#3E435D] mb-1"><strong>Frequency:</strong> {selectedMedObject.frequency}</p>
              )}
              {selectedMedObject.duration && (
                <p className="text-sm text-[#3E435D]"><strong>Duration:</strong> {selectedMedObject.duration}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-[#3E435D] mb-1 block">
              {selectedMedObject ? "Quantity You Bought" : "Amount / Quantity"}
            </label>
            <input 
              type="text" 
              placeholder={selectedMedObject ? "e.g. 30 pills, 2 bottles, 100ml" : "Enter total quantity bought"} 
              className="w-full p-2.5 rounded-lg border border-[#CBC3A5] bg-white text-[#3E435D] text-sm focus:outline-none focus:ring-2 focus:ring-[#3E435D]/50"
              value={medAmount}
              onChange={(e) => setMedAmount(e.target.value)}
            />
          </div>

          <button 
            onClick={handleAddMedicine}
            disabled={!selectedMed}
            className="w-full bg-[#3E435D] text-[#D3D0BC] py-2.5 rounded-lg font-semibold text-sm hover:bg-[#4a5070] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add to My List
          </button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[#9AA7B1] uppercase tracking-wider">Added Medications</h3>
          {confirmedMeds.length === 0 ? (
            <p className="text-sm text-[#9AA7B1] italic">No medications added yet.</p>
          ) : (
            confirmedMeds.map((med) => (
              <div key={med.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-[#CBC3A5]/50">
                <div>
                  <p className="text-[#3E435D] font-bold text-sm">{med.name}</p>
                  <p className="text-[#9AA7B1] text-xs">{med.dosage}</p>
                </div>
                <button 
                  onClick={() => handleRemove(med.id, med.name)}
                  className="text-red-400 hover:text-red-600 p-1.5 bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FIXED FOOTER BUTTON */}
      <button 
        onClick={handleSaveToPharmacy}
        disabled={confirmedMeds.length === 0}
        className="w-full mt-4 pt-4 border-t border-[#D3D0BC]/30 bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
      >
        <Save className="w-4 h-4" /> Save & Send to Pharmacy Page
      </button>
    </div>
  );
}
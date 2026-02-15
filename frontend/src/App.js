import React, { useState } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, AlertCircle, Pill, ShieldAlert } from 'lucide-react';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return alert("Please select a file first!");
    setLoading(true);
    setError(null);
    setResult(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/api/scan', formData);
      // Ensure we set only the extracted data to state
      setResult(response.data);
    } catch (err) {
      console.error("Connection failed", err);
      setError("Failed to digitize record. Ensure backend is running and file is readable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-blue-900">SurgiSense AI</h1>
        <p className="text-slate-500 italic">End-to-End Surgical Safety Ecosystem [cite: 12]</p>
      </header>

      {/* Upload Section */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="border-2 border-dashed border-blue-200 rounded-xl p-10 flex flex-col items-center">
          <Upload className="text-blue-500 mb-4" size={48} />
          <input 
            type="file" 
            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        <button 
          onClick={handleUpload}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:bg-slate-400"
        >
          {loading ? "Digitizing Record..." : "Scan & Go [cite: 15]"}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
            <AlertCircle className="mr-2" size={18} />
            {error}
          </div>
        )}
      </div>

      {/* Result Dashboard - Rendered only when result exists */}
      {result && result.data && (
        <div className="mt-12 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-blue-600 text-white p-6 rounded-t-2xl shadow-lg">
            <h2 className="text-2xl font-bold">{result.data.surgery_type || "Surgical Procedure"}</h2>
            <p className="opacity-90">Scheduled Date: {result.data.surgery_date || "Not Found"}</p>
          </div>

          <div className="bg-white p-6 rounded-b-2xl shadow-xl border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <Pill className="text-blue-600 mr-2" size={20} />
              Smart Medication Tracker
            </h3>
            <div className="space-y-3">
              {result.data.medication_list?.map((med, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-700">{med.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{med.dosage}</p>
                  </div>
                  <span className="text-blue-700 font-semibold bg-blue-100 px-3 py-1 rounded-full text-xs">
                    {med.frequency}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-4 flex items-center">
              <ShieldAlert className="text-orange-600 mr-2" size={20} />
              Safety Restrictions
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.data.pre_op_restrictions?.map((rule, index) => (
                <li key={index} className="text-sm text-slate-600 bg-orange-50 p-3 rounded-lg border border-orange-100 shadow-sm">
                  • {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
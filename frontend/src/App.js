import React, { useState } from 'react';
import axios from 'axios';
import { Upload, AlertCircle, Pill, ShieldAlert, FileText } from 'lucide-react';
import Voice from './Voice'; 
import Vision from './Vision';

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
      setResult(response.data);
    } catch (err) {
      console.error("Connection failed", err);
      setError("Failed to digitize record. Ensure backend is running and file is readable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-800">
      
      {/* Header */}
      <header className="mb-10 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-extrabold text-blue-900 tracking-tight mb-2">
          SurgiSense <span className="text-blue-600">AI</span>
        </h1>
        <p className="text-slate-500 font-medium">End-to-End Surgical Safety Ecosystem</p>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-5xl mx-auto space-y-8">
        
        {/* Module 1: Document Scanner */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row items-center gap-6">
            
            {/* Upload Area */}
            <div className="flex-1 w-full border-2 border-dashed border-blue-200 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 transition-colors relative group">
              <Upload className="text-blue-500 mb-3" size={36} />
              <span className="text-sm font-medium text-slate-600 mb-2">Upload Discharge Summary</span>
              <span className="text-xs text-slate-400">PDF or TXT</span>
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file && (
                <div className="absolute bottom-2 text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full flex items-center gap-1">
                  <FileText size={12} /> {file.name}
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="w-full md:w-auto flex flex-col gap-3">
              <button 
                onClick={handleUpload}
                disabled={loading || !file}
                className="w-full md:w-64 bg-blue-600 text-white py-4 rounded-xl font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none active:scale-95"
              >
                {loading ? "Digitizing Record..." : "Scan Document"}
              </button>
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 max-w-[256px]">
                  <AlertCircle size={14} className="shrink-0" /> {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module 1 Results: Rendered only when result exists */}
        {result && result.data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-600 text-white p-6 rounded-t-2xl shadow-sm">
              <h2 className="text-xl font-bold">{result.data.surgery_type || "Surgical Procedure"}</h2>
              <p className="text-sm text-blue-100 mt-1">Scheduled Date: {result.data.surgery_date || "Not Found"}</p>
            </div>

            <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-slate-200 border-t-0">
              
              <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide">
                <Pill className="text-blue-600 mr-2" size={18} /> Smart Medication Tracker
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {result.data.medication_list?.map((med, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-700 text-sm">{med.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{med.dosage}</p>
                    </div>
                    <span className="text-blue-700 font-bold bg-blue-100 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider">
                      {med.frequency}
                    </span>
                  </div>
                ))}
              </div>

              <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center uppercase tracking-wide">
                <ShieldAlert className="text-orange-600 mr-2" size={18} /> Safety Restrictions
              </h3>
              <ul className="grid grid-cols-1 gap-2">
                {result.data.pre_op_restrictions?.map((rule, index) => (
                  <li key={index} className="text-sm font-medium text-slate-700 bg-orange-50/50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                    <span className="text-orange-500 font-bold">•</span> {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Modules 2 & 3: AI Senses (Voice & Vision Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Voice />
          <Vision />
        </div>

      </main>
    </div>
  );
}

export default App;
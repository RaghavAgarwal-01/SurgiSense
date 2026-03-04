import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, FileText, Upload, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "http://localhost:8000";

export default function RecordDigitization() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/api/digitize-record`, formData);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to digitize the record. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D3D0BC] to-[#D3D0BC]/90">
      {/* Header */}
      <header className="bg-[#3E435D]/95 backdrop-blur-md px-5 py-3 sticky top-0 z-10 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/dashboard" className="text-[#D3D0BC] hover:bg-white/10 p-1.5 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-[#CBC3A5] rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#3E435D]" />
          </div>
          <div>
            <h1 className="text-[#D3D0BC] text-base font-semibold leading-tight">Record Digitization</h1>
            <p className="text-[#9AA7B1] text-xs">Upload & extract medical records</p>
          </div>
        </div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto px-5 py-6 space-y-5"
      >
        {/* Upload Section */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-[#3E435D]/5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#CBC3A5]" />
            </div>
            <h2 className="text-[#3E435D] text-base font-bold">Upload Medical Record</h2>
          </div>

          <div className="border-2 border-dashed border-[#CBC3A5]/40 rounded-xl p-8 text-center hover:border-[#CBC3A5] transition-colors bg-[#D3D0BC]/10">
            <Upload className="w-9 h-9 text-[#9AA7B1] mx-auto mb-3 opacity-60" />
            <p className="text-[#3E435D] font-semibold text-sm mb-1">
              {file ? file.name : "Select a PDF to digitize"}
            </p>
            {file && (
              <p className="text-[#9AA7B1] text-xs mb-2">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              id="record-upload"
              onChange={(e) => {
                setFile(e.target.files[0]);
                setData(null);
                setError("");
              }}
            />
            <label
              htmlFor="record-upload"
              className="inline-block mt-2 bg-[#D3D0BC]/40 text-[#3E435D] px-5 py-2 rounded-xl cursor-pointer hover:bg-[#CBC3A5]/40 transition-colors font-semibold text-sm"
            >
              Choose File
            </label>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-[#d4183d]/10 text-[#d4183d] text-xs rounded-xl flex items-center gap-2"
              >
                <AlertCircle size={14} /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
              !file
                ? "bg-[#9AA7B1]/20 text-[#9AA7B1] cursor-not-allowed"
                : loading
                ? "bg-[#3E435D]/70 text-[#D3D0BC] cursor-wait"
                : "bg-[#3E435D] text-[#D3D0BC] hover:bg-[#4a5070] shadow-md shadow-[#3E435D]/15"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={15} /> Processing PDF...
              </>
            ) : (
              <>
                <FileText size={15} /> Digitize Record
              </>
            )}
          </button>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {data && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-[#3E435D]/5"
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#9AA7B1]/15 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-[#3E435D]" />
                </div>
                <h2 className="text-[#3E435D] text-base font-bold">Extracted Data</h2>
              </div>
              <pre className="text-xs bg-[#D3D0BC]/10 text-[#3E435D] p-4 rounded-xl overflow-x-auto leading-relaxed border border-[#3E435D]/5 max-h-96 overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
import ReactMarkdown from 'react-markdown';
import React, { useState } from 'react';
import axios from 'axios';
import { Eye, UploadCloud, Loader2, FileWarning, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import API_BASE from "./api";

const Vision = ({ onAnalysisComplete }) => {
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);
    const [analysis, setAnalysis] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setAnalysis("");
        setError("");
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await axios.post(
                `${API_BASE}/api/analyze-wound`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
            if (!response.data?.analysis) throw new Error("Invalid response from server");
            setAnalysis(response.data.analysis);
            onAnalysisComplete?.(response.data.analysis, preview);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || "Failed to analyze the image. Backend not reachable.");
        } finally {
            setLoading(false);
        }
    };

    const getSeverityDetails = (text) => {
        const match =
            text.match(/(\d+)\s*(?:\/|out of)\s*10|\\boxed\{(\d+)\}/i) ||
            text.match(/(?:severity|score)[\s:]*(\d+)/i);
        const score = match ? parseInt(match[1] || match[2], 10) : null;
        if (!score || score < 1 || score > 10) return null;

        if (score <= 3) return { score, barColor: 'bg-[#9AA7B1]', bgColor: 'bg-[#D3D0BC]/30', textColor: 'text-[#3E435D]', label: 'Low Risk', icon: ShieldCheck };
        if (score <= 6) return { score, barColor: 'bg-[#CBC3A5]', bgColor: 'bg-[#CBC3A5]/20', textColor: 'text-[#3E435D]', label: 'Monitor Closely', icon: Activity };
        return { score, barColor: 'bg-[#d4183d]', bgColor: 'bg-[#d4183d]/10', textColor: 'text-[#d4183d]', label: 'Critical Alert', icon: AlertTriangle };
    };

    const severity = analysis ? getSeverityDetails(analysis) : null;

    return (
        <div className="w-full bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-[#3E435D]/5 h-full flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#3E435D] rounded-xl flex items-center justify-center">
                    <Eye className="text-[#CBC3A5]" size={16} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-[#3E435D] leading-tight">Wound Analysis</h3>
                    <p className="text-[11px] text-[#9AA7B1]">Clinical Assessment</p>
                </div>
            </div>
            
            <div className="border-2 border-dashed border-[#CBC3A5]/40 rounded-xl mb-4 bg-[#D3D0BC]/10 flex items-center justify-center min-h-36 overflow-hidden relative group shrink-0 hover:border-[#CBC3A5] transition-colors">
                {preview ? (
                    <img src={preview} alt="Wound Preview" className="h-full w-full object-cover rounded-lg" />
                ) : (
                    <div className="flex flex-col items-center text-[#9AA7B1] gap-1.5 p-4">
                        <UploadCloud size={24} className="opacity-60" />
                        <span className="text-xs">Upload surgical site photo</span>
                    </div>
                )}
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Click to upload image"
                />
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 p-2.5 bg-[#d4183d]/10 text-[#d4183d] text-xs rounded-xl flex items-center gap-2 shrink-0"
                    >
                        <FileWarning size={13} /> {error}
                    </motion.div>
                )}
            </AnimatePresence>

            <button 
                onClick={handleAnalyze}
                disabled={!file || loading}
                className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 shrink-0 active:scale-[0.98] ${
                    !file ? 'bg-[#9AA7B1]/20 text-[#9AA7B1] cursor-not-allowed' : 
                    loading ? 'bg-[#3E435D]/70 text-[#D3D0BC] cursor-wait' : 
                    'bg-[#3E435D] text-[#D3D0BC] hover:bg-[#4a5070] shadow-md shadow-[#3E435D]/15'
                }`}
            >
                {loading ? (
                    <> <Loader2 className="animate-spin" size={14} /> Processing Image... </>
                ) : (
                    <> <Activity size={14} /> Generate Severity Score </>
                )}
            </button>


        </div>
    );
};

export default Vision;
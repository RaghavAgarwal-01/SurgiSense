import ReactMarkdown from 'react-markdown';
import React, { useState } from 'react';
import axios from 'axios';
import { Eye, UploadCloud, Loader2, FileWarning, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

const API_BASE = "http://localhost:8000";

const Vision = () => {
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

            if (!response.data?.analysis) {
                throw new Error("Invalid response from server");
            }

            setAnalysis(response.data.analysis);
        } catch (err) {
            console.error(err);
            setError(
                err.response?.data?.detail ||
                "Failed to analyze the image. Backend not reachable."
            );
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

        if (score <= 3) return { score, color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Low Risk', icon: ShieldCheck };
        if (score <= 6) return { score, color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Monitor Closely', icon: Activity };
        return { score, color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'Critical Alert', icon: AlertTriangle };
    };

    const severity = analysis ? getSeverityDetails(analysis) : null;
    return (
        <div className="w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
            <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center justify-center gap-2">
                <Eye className="text-blue-600" size={20} /> Vision Analysis
            </h3>
            <p className="text-xs text-center text-slate-500 mb-6">Clinical Wound Assessment</p>
            
            <div className="border-2 border-dashed border-blue-100 rounded-xl mb-6 bg-slate-50 flex items-center justify-center min-h-[160px] overflow-hidden relative group shrink-0">
                {preview ? (
                    <img src={preview} alt="Wound Preview" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center text-slate-400 gap-2 p-4">
                        <UploadCloud size={28} />
                        <span className="text-sm">Upload surgical site photo</span>
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

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 shrink-0">
                    <FileWarning size={14} /> {error}
                </div>
            )}

            <button 
                onClick={handleAnalyze}
                disabled={!file || loading}
                className={`w-full py-3.5 mb-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white shrink-0 active:scale-[0.98] ${
                    !file ? 'bg-slate-300 cursor-not-allowed' : 
                    loading ? 'bg-blue-400 cursor-wait' : 
                    'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200'
                }`}
            >
                {loading ? (
                    <> <Loader2 className="animate-spin" size={16} /> Processing Image... </>
                ) : (
                    <> <Activity size={16} /> Generate Severity Score </>
                )}
            </button>

            {/* Dynamic Results Section */}
            {analysis && (
                <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    
                    {/* Visual Severity Bar */}
                    {severity && (
                        <div className={`p-4 rounded-xl border ${severity.bg} border-opacity-50`}>
                            <div className="flex justify-between items-center mb-2">
                                <div className={`flex items-center gap-2 font-bold ${severity.text}`}>
                                    <severity.icon size={18} />
                                    <span>{severity.label}</span>
                                </div>
                                <span className={`font-extrabold text-lg ${severity.text}`}>{severity.score}/10</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className={`h-2.5 rounded-full ${severity.color} transition-all duration-1000 ease-out`} 
                                    style={{ width: `${(severity.score / 10) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Clinical Summary Text with ReactMarkdown */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex-1">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Detailed AI Assessment</h4>
                        <div className="text-sm text-slate-700 leading-relaxed overflow-y-auto max-h-[200px] pr-2 custom-scrollbar prose prose-sm prose-slate">
                            <ReactMarkdown>{analysis}</ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vision;
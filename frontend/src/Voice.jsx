import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Mic, Square, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import API_BASE from "./api";

const Voice = () => {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    const startRecording = async () => {
        try {
            setError("");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
                await sendToBackend(audioBlob);
            };

            mediaRecorder.current.start();
            setRecording(true);
        } catch {
            setError("Microphone permission denied.");
        }
    };

    const stopRecording = () => {
        if (!mediaRecorder.current) return;
        mediaRecorder.current.stop();
        setRecording(false);
    };

    const sendToBackend = async (audioBlob) => {
        setLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");

        try {
            const response = await axios.post(
                `${API_BASE}/api/voice-to-text`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
            if (!response.data?.transcript) throw new Error("Invalid transcription response");
            setTranscript(response.data.transcript);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || "Speech service unreachable.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-[#3E435D]/5 h-full flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${recording ? 'bg-[#d4183d]' : 'bg-[#3E435D]'}`}>
                    <Mic className={recording ? 'text-white' : 'text-[#CBC3A5]'} size={16} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-[#3E435D] leading-tight">Voice Intake</h3>
                    <p className="text-[11px] text-[#9AA7B1]">Hindi, English & Hinglish</p>
                </div>
            </div>
            
            <div className={`border-2 border-dashed rounded-xl p-4 mb-4 flex flex-col items-center justify-center min-h-32 transition-all duration-300 ${
                recording ? 'border-[#d4183d]/30 bg-[#d4183d]/5' : 'border-[#CBC3A5]/40 bg-[#D3D0BC]/10 hover:border-[#CBC3A5]'
            }`}>
                {recording ? (
                    <div className="flex flex-col items-center gap-2.5">
                        <div className="relative">
                            <div className="w-10 h-10 bg-[#d4183d]/10 rounded-full flex items-center justify-center">
                                <div className="w-3.5 h-3.5 bg-[#d4183d] rounded-full animate-pulse" />
                            </div>
                            <div className="absolute inset-0 w-10 h-10 bg-[#d4183d]/5 rounded-full animate-ping" />
                        </div>
                        <span className="text-[10px] font-bold text-[#d4183d] uppercase tracking-widest">Recording...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-[#9AA7B1] gap-1.5">
                        <Mic size={24} className="opacity-60" />
                        <span className="text-xs">Tap start to describe symptoms</span>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 p-2.5 bg-[#d4183d]/10 text-[#d4183d] text-xs rounded-xl flex items-center gap-2"
                    >
                        <AlertCircle size={13} /> {error}
                    </motion.div>
                )}
            </AnimatePresence>

            <button 
                onClick={recording ? stopRecording : startRecording}
                className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                    recording 
                        ? 'bg-[#d4183d] text-white hover:bg-[#b01530] shadow-md shadow-[#d4183d]/15' 
                        : 'bg-[#3E435D] text-[#D3D0BC] hover:bg-[#4a5070] shadow-md shadow-[#3E435D]/15'
                }`}
            >
                {recording ? (
                    <> <Square size={14} fill="currentColor" /> Stop & Process </>
                ) : (
                    <> <Mic size={14} /> Start Recording </>
                )}
            </button>

            <AnimatePresence>
                {(transcript || loading) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.25 }}
                        className="mt-4 text-left bg-[#D3D0BC]/10 p-3.5 rounded-xl border border-[#3E435D]/5 min-h-16 flex-1"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="text-[#3E435D]" size={12} />
                            <span className="text-[10px] font-bold text-[#9AA7B1] uppercase tracking-wider">AI Transcript</span>
                        </div>
                        <p className="text-xs text-[#3E435D] leading-relaxed italic">
                            {loading ? (
                                <span className="flex items-center gap-2 text-[#9AA7B1] font-medium not-italic">
                                    <Loader2 className="animate-spin" size={12} /> Transcribing audio...
                                </span>
                            ) : (
                                `"${transcript}"`
                            )}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Voice;
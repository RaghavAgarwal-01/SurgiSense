import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Mic, Square, Loader2, MessageSquare, AlertCircle } from 'lucide-react';

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
            
            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };
            
            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
                await sendToBackend(audioBlob);
            };
            
            mediaRecorder.current.start();
            setRecording(true);
        } catch (err) {
            setError("Microphone access denied. Please allow permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && recording) {
            mediaRecorder.current.stop();
            setRecording(false);
        }
    };

    const sendToBackend = async (audioBlob) => {
        setLoading(true);
        const formData = new FormData();
        formData.append("file", audioBlob, "recording.wav");
        
        try {
            const response = await axios.post("http://localhost:8000/api/voice-to-text", formData);
            setTranscript(response.data.transcript);
        } catch (err) {
            setError("Failed to connect to the speech service.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center justify-center gap-2">
                <Mic className="text-blue-600" size={20} /> Voice Intake
            </h3>
            <p className="text-xs text-center text-slate-500 mb-6">Speaks Hindi, English & Hinglish</p>
            
            <div className="border-2 border-dashed border-blue-100 rounded-xl p-4 mb-6 bg-slate-50 flex flex-col items-center justify-center min-h-[160px] transition-all">
                {recording ? (
                    <div className="flex flex-col items-center animate-pulse gap-3">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <div className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.6)]"></div>
                        </div>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Recording...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-slate-400 gap-2">
                        <Mic size={28} />
                        <span className="text-sm">Tap start to describe symptoms</span>
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            <button 
                onClick={recording ? stopRecording : startRecording}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white active:scale-[0.98] ${
                    recording ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200'
                }`}
            >
                {recording ? (
                    <> <Square size={16} fill="currentColor" /> Stop & Process </>
                ) : (
                    <> <Mic size={16} /> Start Recording </>
                )}
            </button>

            {(transcript || loading) && (
                <div className="mt-6 text-left bg-blue-50/50 p-4 rounded-xl border border-blue-100 min-h-[80px] animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="text-blue-600" size={14} />
                        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">AI Transcript</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed italic">
                        {loading ? (
                            <span className="flex items-center gap-2 text-blue-500 font-medium">
                                <Loader2 className="animate-spin" size={14} /> Transcribing audio...
                            </span>
                        ) : (
                            `"${transcript}"`
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Voice;
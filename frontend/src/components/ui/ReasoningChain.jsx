import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, SkipForward, Loader2 } from "lucide-react";

/**
 * Status icon for each reasoning step.
 */
function StepIcon({ status }) {
  switch (status) {
    case "done":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "skipped":
      return <SkipForward className="w-4 h-4 text-[#9AA7B1]" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    default:
      return <div className="w-4 h-4 rounded-full bg-[#3E435D]/20" />;
  }
}

/**
 * Vertical connector line between steps.
 */
function Connector({ status }) {
  const color =
    status === "done" ? "bg-green-300" :
    status === "warning" ? "bg-amber-300" :
    status === "error" ? "bg-red-300" :
    "bg-[#3E435D]/15";

  return <div className={`w-0.5 h-3 ml-[7px] ${color} transition-colors duration-300`} />;
}

/**
 * ReasoningChain — Animated visualization of the agent's multi-step pipeline.
 *
 * Props:
 *   - chain: Array of { step, action, status, detail, emoji }
 *   - visible: boolean — whether to show the chain
 *   - onClose: callback to dismiss
 *
 * Each step animates in sequentially with a staggered delay.
 */
export default function ReasoningChain({ chain = [], visible = false, onClose }) {
  if (!visible || chain.length === 0) return null;

  const statusLabel = (s) => {
    switch (s) {
      case "done": return "Done";
      case "warning": return "Warning";
      case "error": return "Failed";
      case "skipped": return "Skipped";
      case "running": return "Running";
      default: return "";
    }
  };

  const statusBg = (s) => {
    switch (s) {
      case "done": return "bg-green-50 border-green-200";
      case "warning": return "bg-amber-50 border-amber-200";
      case "error": return "bg-red-50 border-red-200";
      case "skipped": return "bg-gray-50 border-gray-200";
      case "running": return "bg-blue-50 border-blue-200";
      default: return "bg-white border-[#3E435D]/10";
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-[#3E435D]/10 p-5 mt-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <h3 className="text-[#3E435D] text-sm font-bold">Agent Reasoning Chain</h3>
                <span className="text-[10px] font-bold text-[#9AA7B1] bg-[#D3D0BC]/30 px-2 py-0.5 rounded-full">
                  {chain.length} steps
                </span>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-[#9AA7B1] hover:text-[#3E435D] text-xs font-medium px-2 py-1 rounded-lg hover:bg-[#D3D0BC]/20 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>

            {/* Steps */}
            <div className="space-y-0">
              {chain.map((step, i) => (
                <div key={step.step}>
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.12 }}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border ${statusBg(step.status)} transition-colors duration-300`}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      <StepIcon status={step.status} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{step.emoji}</span>
                        <span className="text-[#3E435D] text-xs font-bold">{step.action}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                          step.status === "done" ? "text-green-600 bg-green-100" :
                          step.status === "warning" ? "text-amber-600 bg-amber-100" :
                          step.status === "error" ? "text-red-600 bg-red-100" :
                          step.status === "skipped" ? "text-gray-500 bg-gray-100" :
                          "text-blue-600 bg-blue-100"
                        }`}>
                          {statusLabel(step.status)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9AA7B1] mt-0.5 leading-snug">{step.detail}</p>
                    </div>
                  </motion.div>

                  {/* Connector line between steps */}
                  {i < chain.length - 1 && <Connector status={step.status} />}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

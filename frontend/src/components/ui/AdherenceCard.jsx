import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Flame, TrendingUp, AlertCircle } from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

/**
 * SVG circular progress ring.
 * Renders a donut arc filled to `percent`.
 */
function CircularProgress({ percent, size = 100, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color =
    percent >= 80 ? "#22c55e" : percent >= 50 ? "#eab308" : "#ef4444";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-[#3E435D]/10"
        strokeWidth={strokeWidth}
      />
      {/* Filled arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

/**
 * Tiny horizontal bar for per-medication breakdown.
 */
function MiniBar({ name, percent }) {
  const color =
    percent >= 80
      ? "bg-green-400"
      : percent >= 50
      ? "bg-amber-400"
      : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[#3E435D] text-xs font-medium w-24 truncate">
        {name}
      </span>
      <div className="flex-1 h-1.5 bg-[#3E435D]/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-bold text-[#9AA7B1] w-8 text-right">
        {percent}%
      </span>
    </div>
  );
}

/**
 * AdherenceCard — Phase 3 Compliance Agent dashboard widget.
 *
 * Displays:
 *  - Circular progress ring with weekly adherence %
 *  - Current streak badge
 *  - "Most missed" insight text
 *  - Per-medication mini bars
 *  - 7-day sparkline bar chart
 */
export default function AdherenceCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/agent/adherence-stats?days=7`,
          getAuthHeaders()
        );
        if (res.data?.status === "success") {
          setStats(res.data);
        }
      } catch (err) {
        console.error("Failed to load adherence stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5 animate-pulse">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 bg-[#3E435D]/10 rounded-xl" />
          <div className="w-40 h-4 bg-[#3E435D]/10 rounded-full" />
        </div>
        <div className="flex items-center justify-center py-6">
          <div className="w-[100px] h-[100px] bg-[#3E435D]/10 rounded-full" />
        </div>
      </div>
    );
  }

  if (!stats || stats.total_tasks === 0) {
    return null; // Don't render if no data
  }

  const pct = stats.overall_percent;
  const streak = stats.streak;
  const missedSlot = stats.most_missed_slot;
  const perMed = stats.per_medication || [];
  const daily = stats.daily_breakdown || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#3E435D]/5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#3E435D] rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#CBC3A5]" />
          </div>
          <div>
            <h2 className="text-[#3E435D] text-lg font-bold leading-tight">
              Adherence
            </h2>
            <p className="text-[#9AA7B1] text-xs">Last 7 days</p>
          </div>
        </div>
        {/* Streak badge */}
        {streak > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-amber-700">
              {streak} day{streak !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Main stats row */}
      <div className="flex items-center gap-6 mb-5">
        {/* Circular progress */}
        <div className="relative shrink-0">
          <CircularProgress percent={pct} size={90} strokeWidth={7} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[#3E435D] text-xl font-bold leading-none">
              {pct}%
            </span>
            <span className="text-[#9AA7B1] text-[9px] font-semibold uppercase tracking-wider mt-0.5">
              adherence
            </span>
          </div>
        </div>

        {/* Stats + insight */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[#3E435D] text-lg font-bold leading-none">
                {stats.completed_tasks}
                <span className="text-[#9AA7B1] text-sm font-medium">
                  /{stats.total_tasks}
                </span>
              </p>
              <p className="text-[#9AA7B1] text-[10px] uppercase font-bold tracking-wider mt-0.5">
                tasks done
              </p>
            </div>
          </div>
          {/* "Most missed" insight */}
          {missedSlot && (
            <div className="flex items-start gap-1.5 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-600 font-medium leading-snug">
                You tend to skip the{" "}
                <span className="font-bold">{missedSlot}</span> dose
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 7-day sparkline */}
      {daily.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#9AA7B1]" />
            <span className="text-[10px] font-bold text-[#9AA7B1] uppercase tracking-wider">
              Daily Trend
            </span>
          </div>
          <div className="flex items-end gap-1 h-10">
            {daily.map((day, i) => {
              const barColor =
                day.percent >= 80
                  ? "bg-green-400"
                  : day.percent >= 50
                  ? "bg-amber-400"
                  : day.percent > 0
                  ? "bg-red-400"
                  : "bg-[#3E435D]/10";
              const dayLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
                "en-IN",
                { weekday: "narrow" }
              );
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{
                      height: `${Math.max(day.percent * 0.4, day.total > 0 ? 3 : 1)}px`,
                    }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className={`w-full rounded-sm ${barColor}`}
                    title={`${day.date}: ${day.percent}%`}
                  />
                  <span className="text-[8px] text-[#9AA7B1] font-semibold">
                    {dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-medication mini bars */}
      {perMed.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-[#9AA7B1] uppercase tracking-wider">
            Per Medication
          </span>
          {perMed.map((med, i) => (
            <MiniBar key={i} name={med.name} percent={med.percent} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

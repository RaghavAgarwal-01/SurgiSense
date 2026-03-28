// frontend/src/api.js
// Single source of truth for the backend URL.
// In development: reads from VITE_API_BASE or falls back to localhost.
// In production (Vercel): reads from the VITE_API_BASE env variable set in dashboard.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default API_BASE;

// ── Usage ─────────────────────────────────────────────────────────────────────
// Replace every file that has:
//   const API_BASE = "http://localhost:8000";
// with:
//   import API_BASE from "../api";   (adjust relative path per file depth)

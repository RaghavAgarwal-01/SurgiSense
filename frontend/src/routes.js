// src/routes.js  (updated — add /intake route)

import { createBrowserRouter } from "react-router";

import Landing            from "./pages/Landing";
import Chat               from "./pages/Chat";
import Pharmacy           from "./pages/Pharmacy";
import SurgeryReadiness   from "./pages/SurgeryReadiness";
import RecordDigitization from "./components/ui/RecordDigitization";
import Login              from "./pages/Login";
import Signup             from "./pages/Signup";
import Dashboard          from "./pages/Dashboard";
import ProfileSetup       from "./pages/ProfileSetup";
import OAuthSuccess       from "./pages/OauthSuccess";
import IntakeOnboarding   from "./pages/IntakeOnboarding";   // ← NEW

export const router = createBrowserRouter([
  { path: "/",                    Component: Landing },
  { path: "/login",               Component: Login },
  { path: "/signup",              Component: Signup },
  { path: "/oauth-success",       Component: OAuthSuccess },
  { path: "/setup-profile",       Component: ProfileSetup },
  { path: "/dashboard",           Component: Dashboard },

  // ── NEW: post-login intake flow ──────────────────────────────────────────
  // After login/signup, redirect here instead of /setup-profile.
  // IntakeOnboarding replaces ProfileSetup for new users.
  { path: "/intake",              Component: IntakeOnboarding },

  // Existing routes (unchanged)
  { path: "/record-digitization", Component: RecordDigitization },
  { path: "/chat",                Component: Chat },
  { path: "/pharmacy",            Component: Pharmacy },
  { path: "/surgery-readiness",   Component: SurgeryReadiness },
]);

// ── Auth redirect logic ──────────────────────────────────────────────────────
// In Login.jsx and OauthSuccess.jsx, change the post-login redirect from:
//   navigate("/dashboard")
// to:
//   navigate("/intake")
//
// This ensures every new session starts with the intake flow, which then
// redirects to /dashboard after submission.
//
// For returning users who have already submitted an intake, you can check
// GET /api/intake-report on the Dashboard and show a "re-submit intake" button.

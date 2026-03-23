import { createBrowserRouter } from "react-router";

import Landing from "./pages/Landing";
import Chat from "./pages/Chat";
import Pharmacy from "./pages/Pharmacy";
import SurgeryReadiness from "./pages/SurgeryReadiness";
import RecordDigitization from "./components/ui/RecordDigitization";
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/Dashboard"
import ProfileSetup from "./pages/ProfileSetup"
import OAuthSuccess from "./pages/OauthSuccess"
export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/oauth-success",
    Component: OAuthSuccess,
  },
  {
    path: "/setup-profile",
    Component: ProfileSetup,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/record-digitization",
    Component: RecordDigitization,
  },
  {
    path: "/chat",
    Component: Chat,
  },
  {
    path: "/pharmacy",
    Component: Pharmacy,
  },
  {
    path: "/surgery-readiness",
    Component: SurgeryReadiness,
  },
]);

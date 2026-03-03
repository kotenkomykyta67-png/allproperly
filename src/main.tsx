import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Dashboard from "./pages/Dashboard";
import { UserAvatarProvider } from './context/UserAvatarContext';
import "./index.css";
import InviteExpired from "./pages/InviteExpired";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <UserAvatarProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/homepage" element={<App />} />
            <Route path="/features" element={<App />} />
            <Route path="/pricing" element={<App />} />
            <Route path="/about" element={<App />} />
            <Route path="/faqs" element={<App />} />
            <Route path="/support" element={<App />} />
            <Route path="/onboarding/*" element={<App />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<App />} />
            <Route path="/inviteExpired" element={<InviteExpired />} />
          </Routes>
        </BrowserRouter>
      </UserAvatarProvider>
    </ThemeProvider>
  </StrictMode>
);
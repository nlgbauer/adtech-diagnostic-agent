import React, { useState, useEffect } from "react";

// ── Demo access password ──────────────────────────────────────────────
// Change this value to set the shared password you send to the hiring manager.
// Note: this is an interview demo with fully synthetic data, so this gate is
// for access control / keeping it off the open web, not real security.
const PASSWORD = "demo2026";
const STORAGE_KEY = "adtech_demo_unlocked";
// ──────────────────────────────────────────────────────────────────────

const teal = "#1E293B";
const orange = "#2563EB";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

export default function Gate({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true); } catch (e) {}
  }, []);

  const submit = () => {
    if (value.trim() === PASSWORD) {
      setUnlocked(true);
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
    } else {
      setError(true);
    }
  };

  if (unlocked) return children;

  return (
    <div style={{ minHeight: "100vh", background: teal, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "34px 32px", width: "100%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: orange, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "ui-monospace, Menlo, monospace", marginBottom: 8 }}>Nate Bauer · concept</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em", marginBottom: 6 }}>AdTech Deal Diagnostic Agent</div>
        <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55, marginBottom: 20 }}>This is a private interview demo. Enter the access password to continue.</p>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Password"
          style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "11px 13px", border: `1px solid ${error ? "#B02B2B" : "#D8DEE4"}`, borderRadius: 8, outline: "none", marginBottom: error ? 6 : 14, fontFamily: sans }}
        />
        {error && <div style={{ fontSize: 12, color: "#B02B2B", marginBottom: 14 }}>Incorrect password. Please try again.</div>}
        <button
          onClick={submit}
          style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#fff", background: orange, border: "none", borderRadius: 8, padding: "11px 0", cursor: "pointer" }}
        >
          Enter demo
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

const API_BASE = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "";

export default function VerifyEmail() {
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus("error"); return; }
    fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.alreadyVerified) { setStatus("already"); return; }
        if (d.ok) {
          // Update cached club info so banner disappears immediately on redirect
          const raw = localStorage.getItem("tryoutdesk_club");
          if (raw) {
            try {
              const club = JSON.parse(raw);
              club.emailVerified = true;
              localStorage.setItem("tryoutdesk_club", JSON.stringify(club));
            } catch { /* ignore */ }
          }
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", color: "#111" }}>
      <div style={{ marginBottom: 32 }}>
        <span style={{ fontFamily: "'Arial Narrow', Arial, sans-serif", fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Tryout<span style={{ color: "#c8102e" }}>Desk</span>
        </span>
      </div>

      {status === "loading" && (
        <p style={{ color: "#6b7280" }}>Verifying your email…</p>
      )}

      {status === "success" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px", color: "#166534" }}>Email verified!</h1>
          <p style={{ color: "#555", marginBottom: 28 }}>Your email address has been confirmed. Your account is fully set up.</p>
          <a href="/" style={{ display: "inline-block", background: "#c8102e", color: "#fff", textDecoration: "none", fontWeight: 700, padding: "12px 24px", borderRadius: 4 }}>
            Go to TryoutDesk →
          </a>
        </>
      )}

      {status === "already" && (
        <>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px", color: "#0c1a2e" }}>Already verified</h1>
          <p style={{ color: "#555", marginBottom: 28 }}>Your email address is already confirmed.</p>
          <a href="/" style={{ display: "inline-block", background: "#c8102e", color: "#fff", textDecoration: "none", fontWeight: 700, padding: "12px 24px", borderRadius: 4 }}>
            Go to TryoutDesk →
          </a>
        </>
      )}

      {status === "error" && (
        <>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px", color: "#991b1b" }}>Link expired or invalid</h1>
          <p style={{ color: "#555", marginBottom: 28 }}>
            This verification link has expired or already been used. Log in and we'll send you a new one.
          </p>
          <a href="/" style={{ display: "inline-block", background: "#c8102e", color: "#fff", textDecoration: "none", fontWeight: 700, padding: "12px 24px", borderRadius: 4 }}>
            Go to TryoutDesk →
          </a>
        </>
      )}
    </div>
  );
}

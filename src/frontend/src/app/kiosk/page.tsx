"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Scan,
  Keyboard as Keypad,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Delete,
  ArrowLeft,
  RefreshCw,
  ShieldAlert,
  Volume2,
  VolumeX,
  Camera,
  UserCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type KioskMode = "ambient" | "keypad" | "result";

interface CheckInResult {
  success: boolean;
  status: "approved" | "warning" | "denied" | "denied_not_found";
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    membership_status?: string;
    phone?: string;
  };
  reasons?: string[];
  error?: string;
}

export default function KioskPage() {
  const [mode, setMode] = useState<KioskMode>("ambient");
  const [tenantId, setTenantId] = useState<string>("");
  const [tenantName, setTenantName] = useState<string>("GymPartner Kiosk");
  const [inputVal, setInputVal] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Admin lock modal
  const [adminLockOpen, setAdminLockOpen] = useState<boolean>(false);
  const [adminPin, setAdminPin] = useState<string>("");
  const [adminPinError, setAdminPinError] = useState<string>("");
  const [isLocked, setIsLocked] = useState<boolean>(true);

  // Hidden barcode scan buffer
  const barcodeBufferRef = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch initial tenant
    const initTenant = async () => {
      const { data } = await supabase.from("tenants").select("id, name").limit(1).single();
      if (data) {
        setTenantId(data.id);
        if (data.name) setTenantName(data.name);
      }
    };
    initTenant();
  }, []);

  // Listen for physical barcode scanner keypresses in ambient mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (adminLockOpen) return;
      if (e.key === "Enter") {
        if (barcodeBufferRef.current.trim().length > 0) {
          const scanned = barcodeBufferRef.current.trim();
          barcodeBufferRef.current = "";
          handleCheckIn(scanned);
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        // Clear buffer if typing pauses for > 200ms
        setTimeout(() => {
          if (barcodeBufferRef.current.length > 0 && e.key === barcodeBufferRef.current.slice(-1)) {
            // retain if rapidly scanning
          }
        }, 500);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tenantId, adminLockOpen]);

  // Countdown auto-reset after result display
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === "result" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (mode === "result" && countdown <= 0) {
      resetToAmbient();
    }
    return () => clearInterval(timer);
  }, [mode, countdown]);

  const resetToAmbient = () => {
    setMode("ambient");
    setInputVal("");
    setResult(null);
    setCountdown(5);
    barcodeBufferRef.current = "";
  };

  const playAudioCue = (type: "success" | "warning" | "error") => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === "success") {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else if (type === "warning") {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.setValueAtTime(140, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio Context playback unavailable:", e);
    }
  };

  const handleCheckIn = async (identifier: string) => {
    if (!identifier.trim()) return;
    setLoading(true);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    try {
      const res = await fetch(`${backendUrl}/api/kiosk/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId || "2c604504-41c3-406b-82a0-a43700057af8",
          identifier: identifier.trim(),
          access_method: "kiosk_tablet"
        })
      });

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        setResult({
          success: true,
          status: data.status,
          profile: data.profile,
          reasons: data.reasons
        });
        if (data.status === "approved") {
          playAudioCue("success");
        } else {
          playAudioCue("warning");
        }
      } else {
        setResult({
          success: false,
          status: data.status || "denied",
          error: data.error || "Check-in failed"
        });
        playAudioCue("error");
      }
      setMode("result");
      setCountdown(5);
    } catch (err) {
      console.error("Kiosk API error:", err);
      setLoading(false);
      setResult({
        success: false,
        status: "denied",
        error: "Server connection error. Please try again."
      });
      playAudioCue("error");
      setMode("result");
      setCountdown(5);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === "clear") {
      setInputVal("");
    } else if (val === "back") {
      setInputVal((prev) => prev.slice(0, -1));
    } else {
      if (inputVal.length < 15) {
        setInputVal((prev) => prev + val);
      }
    }
  };

  const verifyAdminPin = async () => {
    if (!adminPin) return;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    try {
      const res = await fetch(`${backendUrl}/api/kiosk/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId || "2c604504-41c3-406b-82a0-a43700057af8",
          pin: adminPin
        })
      });
      const data = await res.json();
      if (data.verified) {
        setAdminLockOpen(false);
        setAdminPin("");
        setAdminPinError("");
        window.location.href = "/reception";
      } else {
        setAdminPinError("Invalid Admin Passcode");
        setAdminPin("");
      }
    } catch (err) {
      setAdminPinError("Verification error");
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground font-sans flex flex-col justify-between p-6 select-none overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-surface-container-highest pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container/20 border border-accent/30 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground uppercase">
              {tenantName}
            </h1>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
              Self-Check-In Kiosk Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 rounded-xl bg-card border border-surface-container-highest text-muted-foreground hover:text-foreground transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-accent" /> : <VolumeX className="w-5 h-5 text-red-400" />}
          </button>
          <button
            onClick={() => setAdminLockOpen(true)}
            className="p-3 rounded-xl bg-card border border-surface-container-highest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <Lock className="w-4 h-4 text-accent" />
            <span>Admin</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center py-8">
        {mode === "ambient" && (
          <div className="flex flex-col items-center text-center max-w-lg w-full space-y-8 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Welcome! Scan Your Pass
              </h2>
              <p className="text-base text-muted-foreground">
                Hold your barcode, member card, or QR code under the scanner
              </p>
            </div>

            {/* Glowing Target Box */}
            <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-3xl bg-card border-2 border-dashed border-accent/40 flex flex-col items-center justify-center shadow-2xl shadow-accent/10 overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-accent/5 animate-pulse"></div>
              <div className="w-full h-1 bg-accent shadow-[0_0_15px_var(--color-accent)] absolute top-0 animate-[bounce_2s_infinite]"></div>

              <Scan className="w-24 h-24 text-accent mb-3 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-bold text-accent uppercase tracking-wider bg-primary-container/20 px-3 py-1 rounded-full border border-accent/30">
                Ready to Scan
              </span>
            </div>

            {/* Alternative Touch Input Option */}
            <div className="w-full pt-4">
              <button
                onClick={() => setMode("keypad")}
                className="w-full py-4 px-6 bg-surface-container-high hover:bg-surface-container-highest border border-border rounded-2xl flex items-center justify-center gap-3 text-lg font-bold text-foreground shadow-lg transition-all active:scale-95"
              >
                <Keypad className="w-6 h-6 text-accent" />
                <span>Forgot Card? Check-in with Phone or PIN</span>
              </button>
            </div>
          </div>
        )}

        {mode === "keypad" && (
          <div className="flex flex-col items-center w-full max-w-md space-y-6">
            <div className="flex items-center justify-between w-full">
              <button
                onClick={resetToAmbient}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Scan</span>
              </button>
              <h2 className="text-lg font-bold text-foreground">Member Phone / PIN</h2>
            </div>

            {/* Input Display Box */}
            <div className="w-full bg-card border-2 border-border rounded-2xl p-4 flex items-center justify-between shadow-inner">
              <input
                ref={inputRef}
                type="text"
                readOnly
                value={inputVal}
                placeholder="Enter Phone or 4-Digit PIN"
                className="bg-transparent border-none text-2xl font-mono font-bold tracking-widest text-accent focus:outline-none w-full text-center placeholder:text-border"
              />
              {inputVal && (
                <button
                  onClick={() => handleKeypadPress("clear")}
                  className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeypadPress(num)}
                  className="h-16 rounded-2xl bg-surface-container-high hover:bg-surface-bright active:bg-primary-container text-2xl font-bold text-white border border-surface-container-highest shadow transition-all active:scale-95 flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleKeypadPress("clear")}
                className="h-16 rounded-2xl bg-surface-container-high hover:bg-red-950/40 text-sm font-bold text-red-400 border border-surface-container-highest flex items-center justify-center"
              >
                CLEAR
              </button>
              <button
                onClick={() => handleKeypadPress("0")}
                className="h-16 rounded-2xl bg-surface-container-high hover:bg-surface-bright active:bg-primary-container text-2xl font-bold text-white border border-surface-container-highest shadow transition-all active:scale-95 flex items-center justify-center"
              >
                0
              </button>
              <button
                onClick={() => handleKeypadPress("back")}
                className="h-16 rounded-2xl bg-surface-container-high hover:bg-surface-bright text-white border border-surface-container-highest flex items-center justify-center text-red-400"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>

            {/* Submit Action Button */}
            <button
              disabled={loading || !inputVal.trim()}
              onClick={() => handleCheckIn(inputVal)}
              className="w-full py-4 rounded-2xl bg-primary-container hover:bg-primary-fixed-dim disabled:opacity-50 text-on-primary-fixed text-xl font-extrabold shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <span>CHECK IN NOW</span>
              )}
            </button>
          </div>
        )}

        {mode === "result" && result && (
          <div className="flex flex-col items-center text-center max-w-md w-full p-8 rounded-3xl bg-card border-2 border-surface-container-highest shadow-2xl space-y-6 animate-scale-up">
            {result.success ? (
              result.status === "approved" ? (
                <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center text-accent shadow-lg shadow-accent/20">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
                  <AlertTriangle className="w-12 h-12" />
                </div>
              )
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/20">
                <XCircle className="w-12 h-12" />
              </div>
            )}

            <div className="space-y-1">
              <h2 className="text-3xl font-extrabold text-white">
                {result.success
                  ? result.status === "approved"
                    ? "ACCESS GRANTED"
                    : "CHECKED IN (ATTENTION)"
                  : "ACCESS DENIED"}
              </h2>
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {result.success ? "Door Relay Signal Sent" : "Please see Receptionist"}
              </p>
            </div>

            {result.profile && (
              <div className="w-full bg-surface-container-high border border-border rounded-2xl p-4 flex items-center gap-4 text-left">
                {result.profile.avatar_url ? (
                  <img
                    src={result.profile.avatar_url}
                    alt="Member"
                    className="w-16 h-16 rounded-xl object-cover border border-accent/40"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary-container/20 border border-accent/30 flex items-center justify-center text-xl font-extrabold text-accent">
                    {result.profile.first_name?.[0]}
                    {result.profile.last_name?.[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {result.profile.first_name} {result.profile.last_name}
                  </h3>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-container/20 text-accent border border-accent/30">
                    {result.profile.membership_status || "Active Member"}
                  </span>
                </div>
              </div>
            )}

            {result.reasons && result.reasons.length > 0 && (
              <div className="w-full bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3 text-left">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Alert Reasons:
                </h4>
                <ul className="text-xs text-amber-200 list-disc list-inside space-y-1">
                  {result.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {!result.success && result.error && (
              <div className="w-full bg-red-950/40 border border-red-500/40 rounded-2xl p-3 text-center">
                <p className="text-sm font-semibold text-red-300">{result.error}</p>
              </div>
            )}

            <div className="pt-2 w-full">
              <button
                onClick={resetToAmbient}
                className="w-full py-3.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-border text-foreground font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Done ({countdown}s)</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Admin Security Passcode Lock Modal */}
      {adminLockOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border-2 border-surface-container-highest rounded-3xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-container-highest pb-3">
              <div className="flex items-center gap-2 text-red-400 font-extrabold">
                <ShieldAlert className="w-5 h-5" />
                <span>Kiosk Security Lock</span>
              </div>
              <button
                onClick={() => {
                  setAdminLockOpen(false);
                  setAdminPin("");
                  setAdminPinError("");
                }}
                className="text-xs text-muted-foreground hover:text-white"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Enter Admin Security PIN to exit kiosk mode and access staff terminal.
            </p>

            <div className="bg-background border border-border rounded-xl p-3 text-center font-mono text-2xl font-bold tracking-widest text-accent">
              {adminPin ? "•".repeat(adminPin.length) : <span className="text-border">ENTER PIN</span>}
            </div>

            {adminPinError && (
              <p className="text-xs text-red-400 text-center font-bold">{adminPinError}</p>
            )}

            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    if (adminPin.length < 6) setAdminPin((p) => p + n);
                  }}
                  className="h-12 rounded-xl bg-surface-container-high hover:bg-surface-bright text-lg font-bold text-white border border-surface-container-highest"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setAdminPin("")}
                className="h-12 rounded-xl bg-surface-container-high text-xs font-bold text-red-400 border border-surface-container-highest"
              >
                CLEAR
              </button>
              <button
                onClick={() => {
                  if (adminPin.length < 6) setAdminPin((p) => p + "0");
                }}
                className="h-12 rounded-xl bg-surface-container-high text-lg font-bold text-white border border-surface-container-highest"
              >
                0
              </button>
              <button
                onClick={() => setAdminPin((p) => p.slice(0, -1))}
                className="h-12 rounded-xl bg-surface-container-high text-xs font-bold text-white border border-surface-container-highest"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={verifyAdminPin}
              className="w-full py-3 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-fixed font-extrabold text-sm shadow-lg transition-colors"
            >
              UNLOCK & EXIT KIOSK
            </button>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="text-center text-xs text-muted-foreground border-t border-surface-container-highest pt-3">
        <span>Powered by GymPartner Operations OS • Wall-Mounted Kiosk Mode</span>
      </footer>
    </div>
  );
}

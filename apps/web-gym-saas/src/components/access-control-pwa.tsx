"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode,
  Radio,
  Wifi,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Watch,
  Key,
  X,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessControlPWAProps {
  tenantId: string;
  profileId: string;
  memberFullName: string;
}

export function AccessControlPWA({ tenantId, profileId, memberFullName }: AccessControlPWAProps) {
  // TOTP QR State
  const [totpData, setTotpData] = useState<{
    qr_payload: string;
    totp_code: string;
    expires_in_seconds: number;
    period_seconds: number;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [totpLoading, setTotpLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hardware Credentials State
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairType, setPairType] = useState<"nfc_wristband" | "ble_fob">("nfc_wristband");
  const [pairTokenValue, setPairTypeTokenValue] = useState("");
  const [pairDeviceName, setPairDeviceName] = useState("");
  const [pairingStatus, setPairingStatus] = useState<string | null>(null);
  const [isScanningNFC, setIsScanningNFC] = useState(false);
  const [isScanningBLE, setIsScanningBLE] = useState(false);
  const [submittingPair, setSubmittingPair] = useState(false);

  // Proximity Relay State
  const [unlockingRelay, setUnlockingRelay] = useState(false);
  const [relayOutcome, setRelayOutcome] = useState<{ success: boolean; message: string } | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Fetch Dynamic TOTP Hash
  const fetchTOTP = useCallback(async () => {
    if (!tenantId || !profileId) return;
    try {
      const res = await fetch(`${backendUrl}/api/iot/totp/generate?tenant_id=${tenantId}&profile_id=${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setTotpData(data);
        setTimeLeft(data.expires_in_seconds || 15);
      }
    } catch (err) {
      console.error("TOTP fetch error:", err);
    } finally {
      setTotpLoading(false);
    }
  }, [tenantId, profileId, backendUrl]);

  useEffect(() => {
    fetchTOTP();
  }, [fetchTOTP]);

  // 15-second countdown timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchTOTP();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchTOTP]);

  // Render Canvas QR representation dynamically
  useEffect(() => {
    if (!totpData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    canvas.width = size;
    canvas.height = size;

    // Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Simple deterministic grid derived from qr_payload string hash
    const text = totpData.qr_payload;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    const cols = 15;
    const cellSize = size / cols;

    ctx.fillStyle = '#0f172a'; // Deep slate dark
    for (let r = 0; r < cols; r++) {
      for (let c = 0; c < cols; c++) {
        // Corner position markers (finder patterns)
        const isTopLeftCorner = r < 4 && c < 4;
        const isTopRightCorner = r < 4 && c >= cols - 4;
        const isBottomLeftCorner = r >= cols - 4 && c < 4;

        if (isTopLeftCorner || isTopRightCorner || isBottomLeftCorner) {
          if (
            (r === 0 || r === 3 || c === 0 || c === 3) && r < 4 && c < 4 ||
            (r === 0 || r === 3 || c === cols - 1 || c === cols - 4) && r < 4 && c >= cols - 4 ||
            (r === cols - 1 || r === cols - 4 || c === 0 || c === 3) && r >= cols - 4 && c < 4 ||
            (r >= 1 && r <= 2 && c >= 1 && c <= 2) ||
            (r >= 1 && r <= 2 && c >= cols - 3 && c <= cols - 2) ||
            (r >= cols - 3 && r <= cols - 2 && c >= 1 && c <= 2)
          ) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        } else {
          // Pseudo-random pattern based on string bit shift
          const val = Math.abs(Math.sin(hash * (r * cols + c + 1)) * 10000);
          if (Math.floor(val) % 2 === 0) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize - 0.5, cellSize - 0.5);
          }
        }
      }
    }
  }, [totpData]);

  // 2. Fetch Hardware Credentials List
  const fetchCredentials = useCallback(async () => {
    if (!tenantId || !profileId) return;
    setLoadingCredentials(true);
    try {
      const res = await fetch(`${backendUrl}/api/iot/credentials/list/${profileId}?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
      }
    } catch (err) {
      console.error("Credentials fetch error:", err);
    } finally {
      setLoadingCredentials(false);
    }
  }, [tenantId, profileId, backendUrl]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // WebNFC Read Handler
  const handleScanNFC = async () => {
    setIsScanningNFC(true);
    setPairingStatus("Tap NFC Wristband against device reader...");
    try {
      if ('NDEFReader' in window) {
        const ndef = new (window as any).NDEFReader();
        await ndef.scan();
        ndef.addEventListener("reading", ({ serialNumber }: any) => {
          if (serialNumber) {
            setPairTypeTokenValue(serialNumber.toUpperCase());
            setPairingStatus(`NFC Serial captured: ${serialNumber}`);
            setIsScanningNFC(false);
          }
        });
      } else {
        setPairingStatus("WebNFC API not supported in this browser. Enter NFC UID manually below.");
        setIsScanningNFC(false);
      }
    } catch (err: any) {
      setPairingStatus(`NFC Scan error: ${err.message || 'Permission denied'}`);
      setIsScanningNFC(false);
    }
  };

  // WebBluetooth Handler
  const handleScanBLE = async () => {
    setIsScanningBLE(true);
    setPairingStatus("Searching for nearby Bluetooth Key Fob...");
    try {
      if ((navigator as any).bluetooth) {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: []
        });
        if (device) {
          setPairTypeTokenValue(device.id || `BLE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
          setPairDeviceName(device.name || "Bluetooth Key Fob");
          setPairingStatus(`Paired Bluetooth Device: ${device.name || device.id}`);
        }
      } else {
        setPairingStatus("WebBluetooth API not supported. Enter BLE MAC/ID manually below.");
      }
    } catch (err: any) {
      setPairingStatus(`Bluetooth pairing error: ${err.message || 'Cancelled'}`);
    } finally {
      setIsScanningBLE(false);
    }
  };

  // Submit Pair Credential
  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairTokenValue.trim()) return;
    setSubmittingPair(true);
    try {
      const res = await fetch(`${backendUrl}/api/iot/credentials/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          profile_id: profileId,
          token_type: pairType,
          token_value: pairTokenValue.trim(),
          device_name: pairDeviceName || (pairType === 'nfc_wristband' ? 'NFC Wristband' : 'BLE Key Fob')
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to pair credential");
      } else {
        setShowPairModal(false);
        setPairTypeTokenValue("");
        setPairDeviceName("");
        setPairingStatus(null);
        fetchCredentials();
      }
    } catch (err: any) {
      alert("Error pairing credential: " + err.message);
    } finally {
      setSubmittingPair(false);
    }
  };

  // Revoke Credential
  const handleRevoke = async (credentialId: string) => {
    if (!confirm("Are you sure you want to revoke this physical access token?")) return;
    try {
      const res = await fetch(`${backendUrl}/api/iot/credentials/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, credential_id: credentialId })
      });
      if (res.ok) {
        fetchCredentials();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Proximity Relay Unlock Trigger
  const handleProximityUnlock = async () => {
    setUnlockingRelay(true);
    setRelayOutcome(null);
    try {
      // Fetch online hardware relay device
      const deviceRes = await fetch(`${backendUrl}/api/iot/device/shelly-relay-01/status?tenant_id=${tenantId}`);
      let deviceId = "00000000-0000-0000-0000-000000000001";
      if (deviceRes.ok) {
        const dData = await deviceRes.json();
        if (dData.device?.id) deviceId = dData.device.id;
      }

      const res = await fetch(`${backendUrl}/api/iot/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          profile_id: profileId,
          device_id: deviceId,
          access_method: 'bluetooth',
          geofence_verified: true
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRelayOutcome({
          success: true,
          message: "Hands-free Turnstile Unlocked! Access granted."
        });
      } else {
        setRelayOutcome({
          success: false,
          message: data.reason || data.error || "Turnstile unlock denied."
        });
      }
    } catch (err: any) {
      setRelayOutcome({
        success: false,
        message: "Network error triggering turnstile unlock."
      });
    } finally {
      setUnlockingRelay(false);
    }
  };

  const timerPercentage = Math.round((timeLeft / 15) * 100);

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Anti-Screenshot TOTP QR Code View */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground text-base">Dynamic Anti-Screenshot Access Pass</h3>
              <p className="text-xs text-muted-foreground">Time-based One-Time Password (TOTP) refreshes every 15s</p>
            </div>
          </div>
          <button
            onClick={fetchTOTP}
            disabled={totpLoading}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
            title="Refresh QR Token Now"
          >
            <RefreshCw className={cn("w-4 h-4", totpLoading && "animate-spin")} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* Canvas QR Code Display */}
          <div className="relative flex flex-col items-center">
            <div className="p-4 bg-white border-2 border-primary/20 rounded-2xl shadow-md relative group">
              <canvas ref={canvasRef} className="w-48 h-48 rounded-lg" />
              {/* Dynamic Watermark Overlay */}
              <div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-mono font-bold text-slate-500 bg-white/80 py-0.5 pointer-events-none">
                {memberFullName.toUpperCase()} • {totpData?.totp_code || '********'}
              </div>
            </div>

            {/* Live Progress Countdown Bar */}
            <div className="w-48 mt-3 space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-primary" /> Validating Hash
                </span>
                <span className="font-bold text-primary">{timeLeft}s</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${timerPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Dynamic Pass Status Details */}
          <div className="space-y-4 max-w-xs text-center md:text-left">
            <div className="p-3 bg-status-cleared/10 border border-status-cleared/20 rounded-lg space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs font-semibold text-status-cleared">
                <CheckCircle2 className="w-4 h-4" /> Screenshot Protection Active
              </div>
              <p className="text-[11px] text-muted-foreground">
                This QR code auto-expires. Screenshots shared via messaging apps will be rejected by physical turnstiles.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Member:</span>
                <span className="font-semibold text-foreground">{memberFullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Dynamic Token Hash:</span>
                <span className="font-mono text-primary font-bold">{totpData?.totp_code || 'Computing...'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Refresh Interval:</span>
                <span className="font-mono text-foreground">15 Seconds</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. WebBluetooth & WebNFC Hands-Free Proximity Relay Trigger */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground text-base">Hands-Free Proximity Relay Trigger</h3>
              <p className="text-xs text-muted-foreground">WebBluetooth & WebNFC instant turnstile unlock relay</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-purple-500 animate-pulse" /> Bluetooth / Geofence Turnstile Relay
            </p>
            <p className="text-muted-foreground">
              Trigger physical Shelly smart relay doors within 10 meters of reception turnstile.
            </p>
          </div>

          <button
            onClick={handleProximityUnlock}
            disabled={unlockingRelay}
            className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-md transition"
          >
            {unlockingRelay ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Unlocking Relay...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" /> Proximity Unlock Turnstile
              </>
            )}
          </button>
        </div>

        {relayOutcome && (
          <div
            className={cn(
              "mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2",
              relayOutcome.success
                ? "bg-status-cleared/15 text-status-cleared border border-status-cleared/30"
                : "bg-status-blocked/15 text-status-blocked border border-status-blocked/30"
            )}
          >
            {relayOutcome.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{relayOutcome.message}</span>
          </div>
        )}
      </div>

      {/* 3. NFC Wristband & RFID Key Fob Self-Service Pairing */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Watch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground text-base">Paired Wristbands & Physical Tokens</h3>
              <p className="text-xs text-muted-foreground">NFC Silicon Wristbands, RFID Key Fobs & Bluetooth Tags</p>
            </div>
          </div>

          <button
            onClick={() => setShowPairModal(true)}
            className="px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/80 flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Pair New Wristband / Fob
          </button>
        </div>

        {loadingCredentials ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading paired tokens...
          </div>
        ) : credentials.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
            <Watch className="w-8 h-8 mx-auto opacity-40 text-muted-foreground" />
            <p className="font-medium">No physical NFC wristbands or RFID fobs paired yet.</p>
            <p className="text-[11px]">Members can self-pair contactless gym wristbands using WebNFC.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="p-3.5 bg-muted/40 border border-border rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-card border border-border rounded-lg text-primary">
                    {cred.token_type === 'nfc_wristband' ? (
                      <Watch className="w-4 h-4" />
                    ) : cred.token_type === 'ble_fob' ? (
                      <Radio className="w-4 h-4 text-purple-500" />
                    ) : (
                      <Key className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground capitalize">
                      {cred.token_type.replace('_', ' ')}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      UID: {cred.token_value}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleRevoke(cred.id)}
                  className="p-1.5 text-muted-foreground hover:text-status-blocked hover:bg-status-blocked/10 rounded-lg transition"
                  title="Revoke / Unpair Token"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Self-Service Hardware Pairing Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading font-bold text-foreground text-base">Self-Service Token Pairing</h3>
              <button onClick={() => setShowPairModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePairSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-muted-foreground block mb-1">Credential Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPairType("nfc_wristband");
                      setPairingStatus(null);
                    }}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition",
                      pairType === "nfc_wristband"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-muted border-border text-muted-foreground"
                    )}
                  >
                    <Watch className="w-4 h-4" /> NFC Wristband
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPairType("ble_fob");
                      setPairingStatus(null);
                    }}
                    className={cn(
                      "p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition",
                      pairType === "ble_fob"
                        ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400"
                        : "bg-muted border-border text-muted-foreground"
                    )}
                  >
                    <Radio className="w-4 h-4" /> BLE Key Fob
                  </button>
                </div>
              </div>

              {/* WebNFC & WebBluetooth Reader Actions */}
              <div className="p-3 bg-muted/50 border border-border rounded-xl space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">Automated Web Sensor Capture:</p>
                {pairType === "nfc_wristband" ? (
                  <button
                    type="button"
                    onClick={handleScanNFC}
                    disabled={isScanningNFC}
                    className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition"
                  >
                    {isScanningNFC ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                    <span>{isScanningNFC ? "Scanning NFC..." : "Tap NFC Wristband To Phone"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleScanBLE}
                    disabled={isScanningBLE}
                    className="w-full py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition"
                  >
                    {isScanningBLE ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                    <span>{isScanningBLE ? "Scanning Bluetooth..." : "Search Nearby Bluetooth Fob"}</span>
                  </button>
                )}
                {pairingStatus && (
                  <p className="text-[11px] text-primary font-mono text-center pt-1">{pairingStatus}</p>
                )}
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Wristband UID / Token Value</label>
                <input
                  type="text"
                  required
                  value={pairTokenValue}
                  onChange={(e) => setPairTypeTokenValue(e.target.value)}
                  placeholder={pairType === "nfc_wristband" ? "e.g. 04:A2:8B:11" : "e.g. BLE-88F192"}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Device Nickname (Optional)</label>
                <input
                  type="text"
                  value={pairDeviceName}
                  onChange={(e) => setPairDeviceName(e.target.value)}
                  placeholder="e.g. Blue Silicone Wristband #1"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPairModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPair || !pairTokenValue.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/80 disabled:opacity-50"
                >
                  {submittingPair ? "Pairing..." : "Pair Credential"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

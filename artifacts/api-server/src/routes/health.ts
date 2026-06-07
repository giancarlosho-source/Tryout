import { Router, type IRouter } from "express";
import { networkInterfaces } from "os";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Returns the server's local network IP so clients can build correct QR code URLs
router.get("/server-info", (req, res) => {
  const nets = networkInterfaces();
  const localIPs: string[] = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        localIPs.push(net.address);
      }
    }
  }
  // Best guess: prefer 192.168.x.x, then 10.x.x.x
  const preferred =
    localIPs.find((ip) => ip.startsWith("192.168.")) ??
    localIPs.find((ip) => ip.startsWith("10.")) ??
    localIPs[0] ??
    "localhost";

  const port = (req.socket.localPort ?? 5173);

  // Read tunnel URL from cloudflared log if available
  let tunnelUrl: string | null = null;
  try {
    const log = readFileSync("/tmp/tribe-tunnel.log", "utf8");
    const match = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) tunnelUrl = match[0];
  } catch { /* no tunnel running */ }

  // Bonjour/mDNS hostname — stable across WiFi, hotspot, any local network
  let bonjourName = "";
  try {
    bonjourName = execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim();
  } catch { /* fallback handled below */ }
  if (!bonjourName) bonjourName = networkInterfaces()["en0"]?.[0]?.address ?? preferred;
  const localUrl = `http://${bonjourName}.local:${port}`;

  res.json({ ip: preferred, allIPs: localIPs, port, tunnelUrl, localUrl, bonjourName });
});

export default router;

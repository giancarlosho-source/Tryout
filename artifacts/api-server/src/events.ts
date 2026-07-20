import { Router, type Request, type Response, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, clubsTable } from "@workspace/db";

type Client = { res: Response; clubId: number };
const clients = new Set<Client>();

export function broadcast(event: string, clubId: number, data?: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
  for (const client of clients) {
    if (client.clubId !== clubId) continue;
    try { client.res.write(payload); } catch { clients.delete(client); }
  }
}

function attachClient(req: Request, res: Response, clubId: number) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send a heartbeat immediately so the client knows it's connected
  res.write("event: connected\ndata: {}\n\n");

  const client: Client = { res, clubId };
  clients.add(client);

  // Heartbeat every 20s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* ignore */ }
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

const router: IRouter = Router();

router.get("/events", (req, res) => {
  attachClient(req, res, req.clubId);
});

// Public: stations don't always carry the club JWT, so they subscribe by slug.
router.get("/events/public/:slug", async (req, res): Promise<void> => {
  const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.slug, req.params.slug));
  if (!club) { res.status(404).json({ error: "Club not found." }); return; }
  attachClient(req, res, club.id);
});

export default router;

import { Router, type IRouter } from "express";
import { broadcast } from "../events";
import { BroadcastMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/messages/broadcast", async (req, res): Promise<void> => {
  const parsed = BroadcastMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const message = {
    id: crypto.randomUUID(),
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
  };

  broadcast("admin:message", req.clubId, message);
  res.json({ status: "sent", message });
});

export default router;

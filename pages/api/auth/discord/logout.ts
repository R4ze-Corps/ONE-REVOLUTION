import type { NextApiRequest, NextApiResponse } from "next";
import { clearSession } from "@/lib/discord-auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  clearSession(res);
  if (req.method === "GET") return res.redirect("/");
  return res.status(200).json({ ok: true });
}


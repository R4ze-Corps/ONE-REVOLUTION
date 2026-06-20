import type { NextApiRequest, NextApiResponse } from "next";
import { getAvatarUrl, readSession } from "@/lib/discord-auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const user = readSession(req);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      ...user,
      displayName: user.globalName || user.username,
      avatarUrl: getAvatarUrl(user),
    },
  });
}


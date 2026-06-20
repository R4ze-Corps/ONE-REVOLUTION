import type { NextApiRequest, NextApiResponse } from "next";
import {
  createOAuthState,
  getDiscordClientId,
  getRedirectUri,
} from "@/lib/discord-auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const clientId = getDiscordClientId();
  if (!clientId) {
    return res.redirect(
      "/?authError=Configure%20DISCORD_CLIENT_ID%20ou%20BOT_TOKEN.",
    );
  }

  const state = createOAuthState(res);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: "identify guilds",
    state,
    prompt: "consent",
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params}`);
}



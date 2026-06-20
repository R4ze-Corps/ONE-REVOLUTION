import type { NextApiRequest, NextApiResponse } from "next";
import {
  consumeOAuthState,
  createSession,
  getDiscordClientId,
  getDiscordClientSecret,
  getRedirectUri,
  type DiscordSessionUser,
} from "@/lib/discord-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const code = readQuery(req.query.code);
  const state = readQuery(req.query.state);
  const savedState = consumeOAuthState(req, res);
  const clientId = getDiscordClientId();
  const clientSecret = getDiscordClientSecret();

  if (!code || !state || !savedState || state !== savedState) {
    return res.redirect("/?authError=Login%20Discord%20invalidado.");
  }

  if (!clientId || !clientSecret) {
    return res.redirect(
      "/?authError=Configure%20DISCORD_CLIENT_ID%20e%20DISCORD_CLIENT_SECRET.",
    );
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(req),
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      token_type?: string;
    };

    if (!tokenPayload.access_token) {
      throw new Error("Discord nao retornou access_token.");
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `${tokenPayload.token_type || "Bearer"} ${tokenPayload.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(await userResponse.text());
    }

    const userPayload = (await userResponse.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    const user: DiscordSessionUser = {
      id: userPayload.id,
      username: userPayload.username,
      globalName: userPayload.global_name,
      avatar: userPayload.avatar,
    };

    createSession(res, user);
    return res.redirect("/?auth=discord");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no login Discord.";
    return res.redirect(`/?authError=${encodeURIComponent(message)}`);
  }
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}



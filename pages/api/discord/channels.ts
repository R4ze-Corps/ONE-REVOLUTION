import type { NextApiRequest, NextApiResponse } from "next";
import { getSavedBotCredentials } from "@/pages/api/bot-credentials";

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  position?: number;
  parent_id?: string | null;
};

type ChannelOption = {
  id: string;
  name: string;
  type: number;
  position: number;
};

type ChannelsResponse =
  | {
      ok: true;
      channels: ChannelOption[];
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChannelsResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const savedCredentials = await getSavedBotCredentials();
  const botToken =
    readString(req.body?.botToken) ||
    savedCredentials?.discordToken ||
    readString(process.env.BOT_TOKEN);
  const guildId =
    readString(req.body?.guildId) ||
    savedCredentials?.guildId ||
    readString(process.env.GUILD_ID);

  if (!botToken || !guildId) {
    return res.status(400).json({
      error: "Informe o token do bot e o ID do servidor.",
    });
  }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/channels`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  );

  if (!response.ok) {
    const message =
      response.status === 401
        ? "Token do bot invalido."
        : response.status === 403
          ? "O bot nao tem acesso aos canais deste servidor."
          : response.status === 404
            ? "Servidor nao encontrado para este bot."
            : "Nao foi possivel carregar os canais do Discord.";

    return res.status(response.status).json({ error: message });
  }

  const channels = (await response.json()) as DiscordChannel[];
  const channelOptions = channels
    .filter((channel) => channel.type === 0 || channel.type === 5)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position || 0,
    }));

  return res.status(200).json({
    ok: true,
    channels: channelOptions,
  });
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


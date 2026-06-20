import type { NextApiRequest, NextApiResponse } from "next";
import { getSavedBotCredentials } from "@/pages/api/bot-credentials";

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

type RoleOption = {
  id: string;
  name: string;
  color: number;
  position: number;
};

type RolesResponse =
  | {
      ok: true;
      roles: RoleOption[];
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RolesResponse>,
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
    `https://discord.com/api/v10/guilds/${guildId}/roles`,
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
          ? "O bot nao tem acesso a este servidor."
          : response.status === 404
            ? "Servidor nao encontrado para este bot."
            : "Nao foi possivel carregar os cargos do Discord.";

    return res.status(response.status).json({ error: message });
  }

  const roles = (await response.json()) as DiscordRole[];
  const roleOptions = roles
    .filter((role) => role.name !== "@everyone" && !role.managed)
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    }));

  return res.status(200).json({
    ok: true,
    roles: roleOptions,
  });
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


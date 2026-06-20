import { getSavedBotCredentials } from "@/pages/api/bot-credentials";

type DiscordCredentials = {
  botToken: string;
  guildId: string;
};

export type DiscordGuildMember = {
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  nick?: string | null;
  roles: string[];
};

export async function getDiscordCredentials(
  guildIdOverride?: string,
): Promise<DiscordCredentials> {
  const saved = await getSavedBotCredentials();
  const botToken = saved?.discordToken || process.env.BOT_TOKEN || "";
  const guildId = guildIdOverride || saved?.guildId || process.env.GUILD_ID || "";

  if (!botToken || !guildId) {
    throw new Error("Configure o token do Discord e o ID do servidor.");
  }

  return { botToken, guildId };
}

export async function discordRequest<T>(
  path: string,
  init: RequestInit = {},
  guildIdOverride?: string,
) {
  const { botToken, guildId } = await getDiscordCredentials(guildIdOverride);
  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Discord retornou erro ${response.status}.`);
  }

  if (response.status === 204) return null as T;

  return (await response.json()) as T;
}

export function getDiscordAvatarUrl(member: DiscordGuildMember) {
  const user = member.user;
  if (!user?.avatar) return "";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`;
}

export function getDiscordMemberName(member: DiscordGuildMember) {
  return (
    member.nick ||
    member.user?.global_name ||
    member.user?.username ||
    "Membro Discord"
  );
}


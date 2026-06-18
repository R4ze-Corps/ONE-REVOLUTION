import type { NextApiRequest, NextApiResponse } from "next";
import {
  discordRequest,
  getDiscordAvatarUrl,
  getDiscordMemberName,
  type DiscordGuildMember,
} from "@/lib/discord";

type MemberOption = {
  id: string;
  name: string;
  avatarUrl: string;
  roles: string[];
};

type MembersResponse =
  | {
      ok: true;
      members: MemberOption[];
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MembersResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const members = await discordRequest<DiscordGuildMember[]>(
      "/members?limit=1000",
      {},
    );

    return res.status(200).json({
      ok: true,
      members: members
        .filter((member) => member.user && !member.user.username.endsWith("#0000"))
        .map((member) => ({
          id: member.user!.id,
          name: getDiscordMemberName(member),
          avatarUrl: getDiscordAvatarUrl(member),
          roles: member.roles,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}

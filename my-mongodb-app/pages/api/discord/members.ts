import type { NextApiRequest, NextApiResponse } from "next";
import {
  discordRequest,
  getDiscordAvatarUrl,
  getDiscordMemberName,
  type DiscordGuildMember,
} from "@/lib/discord";

type DiscordRole = {
  id: string;
  name: string;
  position: number;
  managed?: boolean;
};

type MemberOption = {
  id: string;
  name: string;
  avatarUrl: string;
  roles: string[];
  roleNames: string[];
  highestRoleName: string;
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
    const [members, roles] = await Promise.all([
      discordRequest<DiscordGuildMember[]>("/members?limit=1000", {}),
      discordRequest<DiscordRole[]>("/roles", {}),
    ]);

    const rolesById = new Map(
      roles
        .filter((role) => role.name !== "@everyone" && !role.managed)
        .map((role) => [role.id, role]),
    );

    const getMemberRoles = (memberRoleIds: string[]) =>
      memberRoleIds
        .map((roleId) => rolesById.get(roleId))
        .filter((role): role is DiscordRole => Boolean(role))
        .sort((a, b) => b.position - a.position);

    return res.status(200).json({
      ok: true,
      members: members
        .filter((member) => member.user && !member.user.username.endsWith("#0000"))
        .map((member) => {
          const memberRoles = getMemberRoles(member.roles);

          return {
            id: member.user!.id,
            name: getDiscordMemberName(member),
            avatarUrl: getDiscordAvatarUrl(member),
            roles: member.roles,
            roleNames: memberRoles.map((role) => role.name),
            highestRoleName: memberRoles[0]?.name || "Membro",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}


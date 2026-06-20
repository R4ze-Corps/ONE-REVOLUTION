import type { NextApiRequest, NextApiResponse } from "next";
import { readSession } from "@/lib/discord-auth";
import { getDiscordCredentials } from "@/lib/discord";

type PunishmentLogResponse =
  | {
      ok: true;
    }
  | {
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PunishmentLogResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const channelId = readString(req.body?.channelId);
  const memberName = readString(req.body?.memberName);
  const punishment = readString(req.body?.punishment);
  const reason = readString(req.body?.reason);
  const session = readSession(req);
  const appliedBy =
    session?.globalName || session?.username || readString(req.body?.appliedBy) || "Sistema";

  if (!channelId || !memberName || !punishment || !reason) {
    return res.status(400).json({
      error: "Informe canal, membro, punicao e motivo.",
    });
  }

  try {
    const { botToken } = await getDiscordCredentials();
    const date = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const content = [
      "Puni????o aplicada:",
      `Membro: ${memberName}`,
      "",
      `Puni????o: ${punishment}`,
      "",
      `Motivo: ${reason}`,
      "",
      `Aplicado por: ${appliedBy}`,
      "",
      `Data: ${date}`,
    ].join("\n");

    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          allowed_mentions: { parse: [] },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || "Nao foi possivel enviar a punicao no canal.");
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const isPermissionError =
      message.includes("Missing Permissions") ||
      message.includes('"code": 50013') ||
      message.includes("Missing Access") ||
      message.includes('"code": 50001');

    return res.status(isPermissionError ? 403 : 500).json({
      error: isPermissionError
        ? "O bot nao tem permissao para enviar mensagens no canal configurado."
        : message,
    });
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


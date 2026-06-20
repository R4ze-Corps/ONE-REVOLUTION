import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import client from "@/lib/mongodb";
import { readSession } from "@/lib/discord-auth";
import { discordRequest } from "@/lib/discord";
import type { RegisterRequest } from "./index";

type RegisterActionResponse =
  | {
      ok: true;
      request: RegisterRequest & { id: string };
      warning?: string;
    }
  | {
      ok: true;
      deleted: true;
    }
  | {
      error: string;
    };

const databaseName = "one_network";
const requestsCollectionName = "register_requests";
const settingsCollectionName = "register_settings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterActionResponse>,
) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const id = readString(req.query.id);

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Registro invalido." });
  }

  try {
    await client.connect();
    const database = client.db(databaseName);
    const requestsCollection =
      database.collection<RegisterRequest>(requestsCollectionName);

    const request = await requestsCollection.findOne({ _id: new ObjectId(id) });

    if (!request) {
      return res.status(404).json({ error: "Registro nao encontrado." });
    }

    if (req.method === "DELETE") {
      if (readString(req.headers["x-one-developer-mode"]) !== "true") {
        return res.status(403).json({ error: "Modo desenvolvedor necessario." });
      }

      const settings = await database
        .collection(settingsCollectionName)
        .findOne({ guildId: request.guildId });

      if (
        !settings?.roles?.entry?.id ||
        !settings?.roles?.member?.id ||
        !settings?.roles?.mention?.id
      ) {
        return res.status(400).json({
          error: "Configure os tres cargos antes de excluir registros.",
        });
      }

      await runDiscordApprovalStep(
        "remover o Cargo de Membro",
        () =>
          discordRequest(
            `/members/${request.discordUserId}/roles/${settings.roles.member.id}`,
            { method: "DELETE" },
            request.guildId,
          ),
      );
      await runDiscordApprovalStep(
        "remover o Cargo de Mencionar Todos",
        () =>
          discordRequest(
            `/members/${request.discordUserId}/roles/${settings.roles.mention.id}`,
            { method: "DELETE" },
            request.guildId,
          ),
      );
      await runDiscordApprovalStep(
        "aplicar o Cargo de Registro",
        () =>
          discordRequest(
            `/members/${request.discordUserId}/roles/${settings.roles.entry.id}`,
            { method: "PUT" },
            request.guildId,
          ),
      );
      await runDiscordApprovalStep(
        "remover o apelido alterado",
        () => resetMemberNickname(request),
      );

      await requestsCollection.deleteOne({ _id: request._id });

      return res.status(200).json({
        ok: true,
        deleted: true,
      });
    }

    const action = readString(req.body?.action);

    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "Acao invalida." });
    }

    if (request.status !== "pending") {
      return res.status(409).json({ error: "Este registro ja foi resolvido." });
    }

    const now = new Date();
    const resolvedBy = getResolver(req);

    if (action === "reject") {
      const updated = await requestsCollection.findOneAndUpdate(
        { _id: request._id },
        {
          $set: {
            status: "rejected",
            rejectedAt: now,
            updatedAt: now,
            resolvedBy,
          },
        },
        { returnDocument: "after" },
      );

      return res.status(200).json({
        ok: true,
        request: toPublicRequest(updated!),
      });
    }

    const settings = await database
      .collection(settingsCollectionName)
      .findOne({ guildId: request.guildId });

    if (
      !settings?.roles?.entry?.id ||
      !settings?.roles?.member?.id ||
      !settings?.roles?.mention?.id
    ) {
      return res.status(400).json({
        error: "Configure os tres cargos antes de aprovar registros.",
      });
    }

    await runDiscordApprovalStep(
      "aplicar o Cargo de Membro",
      () =>
        discordRequest(
          `/members/${request.discordUserId}/roles/${settings.roles.member.id}`,
          { method: "PUT" },
          request.guildId,
        ),
    );
    await runDiscordApprovalStep(
      "aplicar o Cargo de Mencionar Todos",
      () =>
        discordRequest(
          `/members/${request.discordUserId}/roles/${settings.roles.mention.id}`,
          { method: "PUT" },
          request.guildId,
        ),
    );
    await runDiscordApprovalStep(
      "remover o Cargo de Registro",
      () =>
        discordRequest(
          `/members/${request.discordUserId}/roles/${settings.roles.entry.id}`,
          { method: "DELETE" },
          request.guildId,
        ),
    );
    const nicknameWarning = await tryUpdateMemberNickname(request);

    const updated = await requestsCollection.findOneAndUpdate(
      { _id: request._id },
      {
        $set: {
          status: "approved",
          approvedAt: now,
          updatedAt: now,
          resolvedBy,
        },
      },
      { returnDocument: "after" },
    );

    return res.status(200).json({
      ok: true,
      request: toPublicRequest(updated!),
      ...(nicknameWarning ? { warning: nicknameWarning } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const isPermissionError =
      message.includes("Missing Permissions") ||
      message.includes('"code": 50013') ||
      message.includes("nao tem permissao");

    return res.status(isPermissionError ? 403 : 500).json({
      error: isPermissionError
        ? message
        : message,
    });
  }
}

async function tryUpdateMemberNickname(request: RegisterRequest) {
  try {
    await updateMemberNickname(request, `${request.gameId} | ${request.name}`);

    return "";
  } catch {
    return "N??o conseguimos alterar o nome do usu??rio. por??m os cargos foram aplicados com sucesso";
  }
}

async function resetMemberNickname(request: RegisterRequest) {
  await updateMemberNickname(request, null);
}

async function updateMemberNickname(request: RegisterRequest, nick: string | null) {
  await discordRequest(
    `/members/${request.discordUserId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        nick,
      }),
    },
    request.guildId,
  );
}

async function runDiscordApprovalStep(
  label: string,
  action: () => Promise<unknown>,
) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    if (message.includes("Missing Permissions") || message.includes('"code": 50013')) {
      throw new Error(
        `O bot nao tem permissao para ${label}. No Discord, coloque o cargo do bot acima dos cargos que ele precisa gerenciar e habilite as permissoes Gerenciar Cargos e Gerenciar Apelidos.`,
      );
    }

    throw error;
  }
}

function toPublicRequest(request: RegisterRequest) {
  return {
    ...request,
    id: request._id?.toString() || "",
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getResolver(req: NextApiRequest) {
  const user = readSession(req);
  if (!user) return { id: "system", name: "Sistema" };

  return {
    id: user.id,
    name: user.globalName || user.username || "Discord",
  };
}


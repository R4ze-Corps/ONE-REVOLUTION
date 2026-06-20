import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import client from "@/lib/mongodb";
import { discordRequest } from "@/lib/discord";
import type { RegisterRequest } from "./index";

type RegisterActionResponse =
  | {
      ok: true;
      request: RegisterRequest & { id: string };
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
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const id = readString(req.query.id);
  const action = readString(req.body?.action);

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Registro invalido." });
  }

  if (action !== "approve" && action !== "reject") {
    return res.status(400).json({ error: "Acao invalida." });
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

    if (request.status !== "pending") {
      return res.status(409).json({ error: "Este registro ja foi resolvido." });
    }

    const now = new Date();

    if (action === "reject") {
      const updated = await requestsCollection.findOneAndUpdate(
        { _id: request._id },
        {
          $set: {
            status: "rejected",
            rejectedAt: now,
            updatedAt: now,
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

    await discordRequest(
      `/members/${request.discordUserId}/roles/${settings.roles.member.id}`,
      { method: "PUT" },
      request.guildId,
    );
    await discordRequest(
      `/members/${request.discordUserId}/roles/${settings.roles.mention.id}`,
      { method: "PUT" },
      request.guildId,
    );
    await discordRequest(
      `/members/${request.discordUserId}/roles/${settings.roles.entry.id}`,
      { method: "DELETE" },
      request.guildId,
    );
    await discordRequest(
      `/members/${request.discordUserId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          nick: `${request.gameId} | ${request.name}`,
        }),
      },
      request.guildId,
    );

    const updated = await requestsCollection.findOneAndUpdate(
      { _id: request._id },
      {
        $set: {
          status: "approved",
          approvedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

    return res.status(200).json({
      ok: true,
      request: toPublicRequest(updated!),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
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


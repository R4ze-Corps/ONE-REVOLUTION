import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import client from "@/lib/mongodb";
import {
  discordRequest,
  getDiscordAvatarUrl,
  getDiscordMemberName,
  type DiscordGuildMember,
} from "@/lib/discord";

type SelectedUser = {
  id: string;
  name: string;
};

export type RegisterRequest = {
  _id?: ObjectId;
  guildId: string;
  discordUserId: string;
  discordName: string;
  avatarUrl: string;
  name: string;
  gameId: string;
  phone: string;
  recruiter: SelectedUser;
  indicated: SelectedUser;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
};

type RegisterResponse =
  | {
      ok: true;
      requests?: Array<RegisterRequest & { id: string }>;
      request?: RegisterRequest & { id: string };
    }
  | {
      error: string;
    };

const databaseName = "one_network";
const requestsCollectionName = "register_requests";
const settingsCollectionName = "register_settings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    await client.connect();
    const requestsCollection = client
      .db(databaseName)
      .collection<RegisterRequest>(requestsCollectionName);

    if (req.method === "GET") {
      const status = readString(req.query.status) || "pending";
      const requests = await requestsCollection
        .find({ status: status as RegisterRequest["status"] })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({
        ok: true,
        requests: requests.map(toPublicRequest),
      });
    }

    const settings = await client
      .db(databaseName)
      .collection(settingsCollectionName)
      .findOne({}, { sort: { updatedAt: -1 } });

    if (!settings?.guildId || !settings?.roles?.entry?.id) {
      return res.status(400).json({
        error: "Configure os cargos de registro antes de enviar registros.",
      });
    }

    const discordUserId = readString(req.body?.discordUserId);
    const name = readString(req.body?.name);
    const gameId = readString(req.body?.gameId);
    const phone = readString(req.body?.phone);
    const recruiter = readUser(req.body?.recruiter);
    const indicated = readUser(req.body?.indicated);

    if (!discordUserId || !name || !gameId || !phone || !recruiter || !indicated) {
      return res.status(400).json({
        error: "Preencha todos os campos do registro.",
      });
    }

    const member = await discordRequest<DiscordGuildMember>(
      `/members/${discordUserId}`,
      {},
      settings.guildId,
    );

    if (!member.roles.includes(settings.roles.entry.id)) {
      return res.status(403).json({
        error: "Este usuario nao possui o Cargo de Registro.",
      });
    }

    const now = new Date();
    const request: RegisterRequest = {
      guildId: settings.guildId,
      discordUserId,
      discordName: getDiscordMemberName(member),
      avatarUrl: getDiscordAvatarUrl(member),
      name,
      gameId,
      phone,
      recruiter,
      indicated,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const result = await requestsCollection.insertOne(request);
    request._id = result.insertedId;

    return res.status(201).json({
      ok: true,
      request: toPublicRequest(request),
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

function readUser(value: unknown): SelectedUser | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  const name = readString(record.name);

  return id && name ? { id, name } : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

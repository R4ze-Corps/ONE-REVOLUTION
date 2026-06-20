import type { NextApiRequest, NextApiResponse } from "next";
import client from "@/lib/mongodb";

type SelectedRole = {
  id: string;
  name: string;
};

type RegisterSettings = {
  guildId: string;
  roles: {
    entry: SelectedRole;
    member: SelectedRole;
    mention: SelectedRole;
  };
  updatedAt: Date;
  source: string;
};

type SettingsResponse =
  | {
      ok: true;
      settings: RegisterSettings | null;
    }
  | {
      error: string;
    };

const databaseName = "one_network";
const collectionName = "register_settings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettingsResponse>,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    await client.connect();
    const collection = client
      .db(databaseName)
      .collection<RegisterSettings>(collectionName);

    if (req.method === "GET") {
      const guildId = readString(req.query?.guildId);
      const settings = guildId
        ? await collection.findOne({ guildId })
        : await collection.findOne({}, { sort: { updatedAt: -1 } });

      return res.status(200).json({
        ok: true,
        settings,
      });
    }

    const guildId = readString(req.body?.guildId);
    const roles = req.body?.roles;
    const entry = readRole(roles?.entry);
    const member = readRole(roles?.member);
    const mention = readRole(roles?.mention);

    if (!guildId || !entry || !member || !mention) {
      return res.status(400).json({
        error: "Selecione os tres cargos antes de salvar.",
      });
    }

    const settings: RegisterSettings = {
      guildId,
      roles: {
        entry,
        member,
        mention,
      },
      updatedAt: new Date(),
      source: "one-network-site",
    };

    await collection.updateOne(
      { guildId },
      {
        $set: settings,
      },
      { upsert: true },
    );

    return res.status(200).json({
      ok: true,
      settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}

function readRole(value: unknown): SelectedRole | null {
  if (!value || typeof value !== "object") return null;

  const role = value as Record<string, unknown>;
  const id = readString(role.id);
  const name = readString(role.name);

  if (!id || !name) return null;

  return { id, name };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


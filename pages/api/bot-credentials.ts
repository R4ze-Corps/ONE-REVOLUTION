import type { NextApiRequest, NextApiResponse } from "next";
import client from "@/lib/mongodb";

type BotCredentials = {
  _id: "default";
  oneToken?: string;
  discordToken?: string;
  guildId?: string;
  updatedAt: Date;
  source: string;
};

type CredentialsResponse =
  | {
      ok: true;
      credentials: {
        hasOneToken: boolean;
        hasDiscordToken: boolean;
        guildId: string;
        oneTokenPreview: string;
        discordTokenPreview: string;
        updatedAt?: Date;
      };
    }
  | {
      error: string;
    };

const databaseName = "one_network";
const collectionName = "bot_credentials";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CredentialsResponse>,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    await client.connect();
    const collection = client
      .db(databaseName)
      .collection<BotCredentials>(collectionName);

    const existing = await collection.findOne({ _id: "default" });

    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        credentials: toPublicCredentials(existing),
      });
    }

    const oneToken = readString(req.body?.oneToken);
    const discordToken = readString(req.body?.discordToken);
    const guildId = readString(req.body?.guildId);

    const nextCredentials: BotCredentials = {
      _id: "default",
      oneToken: oneToken || existing?.oneToken,
      discordToken:
        discordToken ||
        existing?.discordToken ||
        readString(process.env.BOT_TOKEN),
      guildId: guildId || existing?.guildId || readString(process.env.GUILD_ID),
      updatedAt: new Date(),
      source: "one-network-site",
    };

    if (!nextCredentials.discordToken || !nextCredentials.guildId) {
      return res.status(400).json({
        error: "Informe o token do Discord e o ID do servidor.",
      });
    }

    await collection.updateOne(
      { _id: "default" },
      { $set: nextCredentials },
      { upsert: true },
    );

    return res.status(200).json({
      ok: true,
      credentials: toPublicCredentials(nextCredentials),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}

export async function getSavedBotCredentials() {
  await client.connect();
  return client
    .db(databaseName)
    .collection<BotCredentials>(collectionName)
    .findOne({ _id: "default" });
}

function toPublicCredentials(credentials: BotCredentials | null) {
  const oneToken = credentials?.oneToken || "";
  const discordToken = credentials?.discordToken || "";

  return {
    hasOneToken: Boolean(oneToken),
    hasDiscordToken: Boolean(discordToken),
    guildId: credentials?.guildId || "",
    oneTokenPreview: maskSecret(oneToken),
    discordTokenPreview: maskSecret(discordToken),
    updatedAt: credentials?.updatedAt,
  };
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "********";

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

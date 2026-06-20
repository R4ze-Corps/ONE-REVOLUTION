import type { NextApiRequest, NextApiResponse } from "next";
import client from "@/lib/mongodb";

type DatabaseEvent = {
  type: string;
  message: string;
  createdAt: Date;
  source: string;
};

type ErrorResponse = {
  error: string;
};

type PostResponse = {
  ok: true;
  id: string;
  event: DatabaseEvent;
};

type GetResponse = {
  ok: true;
  events: Array<DatabaseEvent & { _id: string }>;
};

const databaseName = "one_network";
const collectionName = "events";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostResponse | GetResponse | ErrorResponse>,
) {
  if (req.method === "POST") {
    return createDatabaseEvent(req, res);
  }

  if (req.method === "GET") {
    return listDatabaseEvents(res);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Metodo nao permitido." });
}

async function createDatabaseEvent(
  req: NextApiRequest,
  res: NextApiResponse<PostResponse | ErrorResponse>,
) {
  const message =
    typeof req.body?.message === "string" && req.body.message.trim().length > 0
      ? req.body.message.trim()
      : "Evento de teste salvo no banco de dados.";

  const event: DatabaseEvent = {
    type: "database-test",
    message,
    createdAt: new Date(),
    source: "one-network-site",
  };

  try {
    await client.connect();
    const result = await client
      .db(databaseName)
      .collection<DatabaseEvent>(collectionName)
      .insertOne(event);

    return res.status(201).json({
      ok: true,
      id: result.insertedId.toString(),
      event,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}

async function listDatabaseEvents(
  res: NextApiResponse<GetResponse | ErrorResponse>,
) {
  try {
    await client.connect();
    const events = await client
      .db(databaseName)
      .collection<DatabaseEvent>(collectionName)
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return res.status(200).json({
      ok: true,
      events: events.map((event) => ({
        ...event,
        _id: event._id.toString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}


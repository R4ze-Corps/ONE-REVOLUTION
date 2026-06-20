import type { NextApiRequest, NextApiResponse } from "next";
import client from "@/lib/mongodb";

type FarmProduct = {
  id: string;
  name: string;
  goal: number;
};

type FarmRole = {
  id: string;
  name: string;
};

type FarmSettings = {
  _id: "default";
  globalGoal: number;
  manager: {
    id: string;
    name: string;
  } | null;
  goalRoles: {
    complete: FarmRole;
    incomplete: FarmRole;
    noDelivery: FarmRole;
  };
  products: FarmProduct[];
  updatedAt: Date;
  source: string;
};

type FarmSettingsResponse =
  | {
      ok: true;
      settings: FarmSettings;
    }
  | {
      error: string;
    };

const databaseName = "one_network";
const collectionName = "farm_settings";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FarmSettingsResponse>,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    await client.connect();
    const collection = client
      .db(databaseName)
      .collection<FarmSettings>(collectionName);

    if (req.method === "GET") {
      const settings = await collection.findOne({ _id: "default" });
      return res.status(200).json({
        ok: true,
        settings: settings ? normalizeSettings(settings) : defaultSettings(),
      });
    }

    const globalGoal = readNumber(req.body?.globalGoal);
    const manager = readManager(req.body?.manager);
    const goalRoles = readGoalRoles(req.body?.goalRoles);
    const products = Array.isArray(req.body?.products)
      ? req.body.products.map(readProduct).filter(Boolean)
      : [];

    if (!globalGoal || !manager || !goalRoles || !products.length) {
      return res.status(400).json({
        error:
          "Informe a meta global, o gerente, os cargos de meta e pelo menos um produto.",
      });
    }

    const settings: FarmSettings = {
      _id: "default",
      globalGoal,
      manager,
      goalRoles,
      products,
      updatedAt: new Date(),
      source: "one-network-site",
    };

    await collection.updateOne(
      { _id: "default" },
      { $set: settings },
      { upsert: true },
    );

    return res.status(200).json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
}

function defaultSettings(): FarmSettings {
  return {
    _id: "default",
    globalGoal: 100,
    manager: null,
    goalRoles: defaultGoalRoles(),
    products: [],
    updatedAt: new Date(),
    source: "one-network-site",
  };
}

function normalizeSettings(settings: FarmSettings): FarmSettings {
  const goalRoles = readGoalRoles(settings.goalRoles) || defaultGoalRoles();

  return {
    ...settings,
    goalRoles,
  };
}

function defaultGoalRoles(): FarmSettings["goalRoles"] {
  return {
    complete: { id: "", name: "Meta OK" },
    incomplete: { id: "", name: "Meta Parcial" },
    noDelivery: { id: "", name: "Sem Entrega" },
  };
}

function readManager(value: unknown): FarmSettings["manager"] {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  const name = readString(record.name);

  return id && name ? { id, name } : null;
}

function readGoalRoles(value: unknown): FarmSettings["goalRoles"] | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const complete = readRole(record.complete);
  const incomplete = readRole(record.incomplete) || readRole(record.partial);
  const noDelivery = readRole(record.noDelivery);

  return complete && incomplete && noDelivery
    ? { complete, incomplete, noDelivery }
    : null;
}

function readRole(value: unknown): FarmRole | null {
  if (typeof value === "string") {
    const name = value.replace(/^@/, "").trim();
    return name ? { id: name, name } : null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  const name = readString(record.name);

  return id && name ? { id, name } : null;
}

function readProduct(value: unknown): FarmProduct | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const id = readString(record.id) || crypto.randomUUID();
  const name = readString(record.name);
  const goal = readNumber(record.goal);

  return name && goal ? { id, name, goal } : null;
}

function readNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


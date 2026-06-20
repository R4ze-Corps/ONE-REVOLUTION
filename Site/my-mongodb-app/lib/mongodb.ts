import { MongoClient } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

const uri = process.env.MONGODB_URI || process.env.one_MONGODB_URI;

if (!uri) {
  throw new Error(
    'Invalid/Missing environment variable: "MONGODB_URI" or "one_MONGODB_URI"',
  );
}

const options = { appName: "devrel.template.nextjs" };
const connectionUri = getConnectionUri(uri);

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
  };

  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(connectionUri, options);
  }
  client = globalWithMongo._mongoClient;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(connectionUri, options);
}

attachDatabasePool(client);

// Export a module-scoped MongoClient. By doing this in a
// separate module, the client can be shared across functions.

export default client;

function getConnectionUri(value: string) {
  const parsed = new URL(value);

  if (
    parsed.protocol !== "mongodb+srv:" ||
    parsed.hostname !== "onex.yizmtzz.mongodb.net"
  ) {
    return value;
  }

  const directHosts = [
    "ac-mc59wa0-shard-00-00.yizmtzz.mongodb.net:27017",
    "ac-mc59wa0-shard-00-01.yizmtzz.mongodb.net:27017",
    "ac-mc59wa0-shard-00-02.yizmtzz.mongodb.net:27017",
  ].join(",");

  parsed.protocol = "mongodb:";
  parsed.host = directHosts;
  parsed.searchParams.set("authSource", "admin");
  parsed.searchParams.set("replicaSet", "atlas-ixatzx-shard-0");
  parsed.searchParams.set("tls", "true");

  return parsed.toString();
}

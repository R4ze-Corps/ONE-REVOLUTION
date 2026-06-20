import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

export type DiscordSessionUser = {
  id: string;
  username: string;
  globalName?: string | null;
  avatar?: string | null;
};

const sessionCookieName = "one_discord_session";
const stateCookieName = "one_discord_oauth_state";

export function getDiscordClientId() {
  const explicitClientId = readString(process.env.DISCORD_CLIENT_ID);
  if (explicitClientId) return explicitClientId;

  const botToken = readString(process.env.BOT_TOKEN);
  return botToken.split(".")[0] || "";
}

export function getDiscordClientSecret() {
  return readString(process.env.DISCORD_CLIENT_SECRET);
}

export function getAuthSecret() {
  return (
    readString(process.env.AUTH_SECRET) ||
    readString(process.env.NEXTAUTH_SECRET) ||
    "one-x-local-auth-secret"
  );
}

export function getBaseUrl(req: NextApiRequest) {
  const configuredUrl =
    readString(process.env.NEXT_PUBLIC_APP_URL) ||
    readString(process.env.APP_URL);
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const host = req.headers.host || "127.0.0.1:3000";
  const proto = host.includes("127.0.0.1") || host.includes("localhost")
    ? "http"
    : "https";
  return `${proto}://${host}`;
}

export function getRedirectUri(req: NextApiRequest) {
  return `${getBaseUrl(req)}/api/auth/discord/callback`;
}

export function createOAuthState(res: NextApiResponse) {
  const state = crypto.randomBytes(24).toString("hex");
  setCookie(res, stateCookieName, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    sameSite: "lax",
    path: "/",
  });
  return state;
}

export function consumeOAuthState(req: NextApiRequest, res: NextApiResponse) {
  const state = req.cookies[stateCookieName] || "";
  clearCookie(res, stateCookieName);
  return state;
}

export function createSession(res: NextApiResponse, user: DiscordSessionUser) {
  const payload = Buffer.from(
    JSON.stringify({
      user,
      createdAt: Date.now(),
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(payload)
    .digest("base64url");

  setCookie(res, sessionCookieName, `${payload}.${signature}`, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    sameSite: "lax",
    path: "/",
  });
}

export function readSession(req: NextApiRequest): DiscordSessionUser | null {
  const value = req.cookies[sessionCookieName];
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(payload)
    .digest("base64url");

  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return decoded.user || null;
  } catch {
    return null;
  }
}

export function clearSession(res: NextApiResponse) {
  clearCookie(res, sessionCookieName);
}

export function getAvatarUrl(user: DiscordSessionUser) {
  if (!user.avatar) return "";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`;
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function setCookie(
  res: NextApiResponse,
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    maxAge?: number;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
  } = {},
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    options.httpOnly ? "HttpOnly" : "",
    options.maxAge ? `Max-Age=${options.maxAge}` : "",
    `SameSite=${options.sameSite || "lax"}`,
  ].filter(Boolean);

  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing)
    ? existing
    : existing
      ? [String(existing)]
      : [];
  res.setHeader("Set-Cookie", [...cookies, parts.join("; ")]);
}

function clearCookie(res: NextApiResponse, name: string) {
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing)
    ? existing
    : existing
      ? [String(existing)]
      : [];
  res.setHeader("Set-Cookie", [
    ...cookies,
    `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax`,
  ]);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}



import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";

export type Role = "coordinator" | "admin";
export interface Session {
  email: string;
  name: string;
  role: Role;
}

const COOKIE = "ts_session";
const MAX_AGE = 60 * 60 * 8; // one working shift

/** ponytail: demo secret. Set SESSION_SECRET as a Worker secret before any real deployment. */
function secret(): string {
  return (process.env.SESSION_SECRET as string | undefined) ?? "trialscreen-demo-secret";
}

const enc = new TextEncoder();

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`trialscreen:${password}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare so a signature cannot be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signIn(email: string, password: string): Promise<Session | null> {
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    "SELECT email, name, role, password_hash FROM users WHERE email = ?",
  )
    .bind(email.trim().toLowerCase())
    .first<{ email: string; name: string; role: Role; password_hash: string }>();

  if (!row) return null;
  if (!safeEqual(await hashPassword(password), row.password_hash)) return null;

  const session: Session = { email: row.email, name: row.name, role: row.role };
  const payload = btoa(JSON.stringify(session));
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${await hmac(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return session;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(await hmac(payload), sig)) return null;
  try {
    return JSON.parse(atob(payload)) as Session;
  } catch {
    return null;
  }
}

/** Every protected page calls this. The role is read from the signed cookie,
 *  never from a header, a query string or anything else the client controls. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(role: Role): Promise<Session> {
  const session = await requireSession();
  if (session.role !== role) redirect("/screen?denied=" + role);
  return session;
}

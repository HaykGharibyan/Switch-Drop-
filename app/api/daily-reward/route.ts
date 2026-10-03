import { env } from "cloudflare:workers";

const DAY_SECONDS = 24 * 60 * 60;
const CLAIM_WINDOW_SECONDS = DAY_SECONDS * 2;
const REWARDS = [100, 150, 200, 250, 300, 350, 550] as const;
const COOKIE_NAME = "switch_drop_player";

type DailyRow = {
  day: number;
  next_claim_at: number;
  expires_at: number;
};

type DailyDatabaseEnv = {
  DAILY_REWARDS_DB: D1Database;
};

const database = () =>
  (env as unknown as DailyDatabaseEnv).DAILY_REWARDS_DB;

async function ensureSchema(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS daily_rewards (
        player_id TEXT PRIMARY KEY,
        day INTEGER NOT NULL,
        next_claim_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    )
    .run();
}

function playerIdentity(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([a-zA-Z0-9-]+)`),
  );
  if (match) return { id: match[1], cookie: null as string | null };

  const id = crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    id,
    cookie: `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
  };
}

function statusFrom(row: DailyRow | null, now: number) {
  const expired = Boolean(row && now > row.expires_at);
  const claimedDay = expired ? 0 : (row?.day ?? 0);
  const canClaim = !row || now >= row.next_claim_at;
  const nextDay = claimedDay >= REWARDS.length ? 1 : claimedDay + 1;
  return {
    serverNow: now,
    claimedDay,
    nextDay,
    canClaim,
    nextClaimAt: canClaim ? now : row!.next_claim_at,
    expiresAt: row?.expires_at ?? null,
    rewards: REWARDS,
  };
}

function json(data: unknown, init: ResponseInit = {}, cookie?: string | null) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function GET(request: Request) {
  try {
    const db = database();
    await ensureSchema(db);
    const player = playerIdentity(request);
    const now = Math.floor(Date.now() / 1000);
    const row = await db
      .prepare(
        "SELECT day, next_claim_at, expires_at FROM daily_rewards WHERE player_id = ?",
      )
      .bind(player.id)
      .first<DailyRow>();
    return json(statusFrom(row, now), {}, player.cookie);
  } catch {
    return json(
      { error: "Daily rewards are temporarily unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = database();
    await ensureSchema(db);
    const player = playerIdentity(request);
    const now = Math.floor(Date.now() / 1000);
    const row = await db
      .prepare(
        "SELECT day, next_claim_at, expires_at FROM daily_rewards WHERE player_id = ?",
      )
      .bind(player.id)
      .first<DailyRow>();

    if (row && now < row.next_claim_at) {
      return json(
        { ...statusFrom(row, now), error: "Reward is not ready yet." },
        { status: 409 },
        player.cookie,
      );
    }

    const currentDay = row && now <= row.expires_at ? row.day : 0;
    const day = currentDay >= REWARDS.length ? 1 : currentDay + 1;
    const nextClaimAt = now + DAY_SECONDS;
    const expiresAt = now + CLAIM_WINDOW_SECONDS;

    let claimed = false;
    if (!row) {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO daily_rewards
            (player_id, day, next_claim_at, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(player.id, day, nextClaimAt, expiresAt, now)
        .run();
      claimed = (result.meta.changes ?? 0) === 1;
    } else {
      const result = await db
        .prepare(
          `UPDATE daily_rewards
             SET day = ?, next_claim_at = ?, expires_at = ?, updated_at = ?
           WHERE player_id = ? AND next_claim_at <= ?`,
        )
        .bind(day, nextClaimAt, expiresAt, now, player.id, now)
        .run();
      claimed = (result.meta.changes ?? 0) === 1;
    }

    if (!claimed) {
      const latest = await db
        .prepare(
          "SELECT day, next_claim_at, expires_at FROM daily_rewards WHERE player_id = ?",
        )
        .bind(player.id)
        .first<DailyRow>();
      return json(
        { ...statusFrom(latest, now), error: "Reward was already claimed." },
        { status: 409 },
        player.cookie,
      );
    }

    const saved: DailyRow = {
      day,
      next_claim_at: nextClaimAt,
      expires_at: expiresAt,
    };
    return json(
      {
        ...statusFrom(saved, now),
        claimed: true,
        reward: REWARDS[day - 1],
        day,
      },
      {},
      player.cookie,
    );
  } catch {
    return json(
      { error: "Daily rewards are temporarily unavailable." },
      { status: 503 },
    );
  }
}

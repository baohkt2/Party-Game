// Database helper functions using Vercel Postgres – Modular Architecture

import { sql } from '@vercel/postgres';
import { nanoid } from 'nanoid';
import { Room, Player, RoomConfig, RoomListItem, RoomStatus } from '@/types';
import { normalizeAvatarUrl } from '@/lib/avatar';

const ROOM_TTL_MINUTES = 5;
let ensureRoomLifecycleSchemaPromise: Promise<void> | null = null;
let hasTriedEnsureRoomLifecycleSchema = false;

function isMissingStatusChangedAtColumn(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.toLowerCase().includes('status_changed_at');
}

async function ensureRoomLifecycleSchema(): Promise<void> {
  if (hasTriedEnsureRoomLifecycleSchema) return;

  if (!ensureRoomLifecycleSchemaPromise) {
    ensureRoomLifecycleSchemaPromise = (async () => {
      try {
        await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP DEFAULT NOW();`;
        await sql`
          UPDATE rooms
          SET status_changed_at = COALESCE(status_changed_at, created_at, NOW())
          WHERE status_changed_at IS NULL
        `;
      } catch (error) {
        console.warn('Unable to auto-ensure room lifecycle schema:', error);
      } finally {
        hasTriedEnsureRoomLifecycleSchema = true;
      }
    })();
  }

  await ensureRoomLifecycleSchemaPromise;
}

// ==================== ROOM OPERATIONS ====================

export async function cleanupExpiredRooms(): Promise<number> {
  try {
    await ensureRoomLifecycleSchema();

    const result = await sql<{ id: string }>`
      DELETE FROM rooms
      WHERE status IN ('waiting', 'configuring', 'finished')
        AND COALESCE(status_changed_at, created_at) < NOW() - (${ROOM_TTL_MINUTES} * INTERVAL '1 minute')
      RETURNING id
    `;

    return result.rows.length;
  } catch (error) {
    if (isMissingStatusChangedAtColumn(error)) {
      try {
        const fallbackResult = await sql<{ id: string }>`
          DELETE FROM rooms
          WHERE status IN ('waiting', 'configuring', 'finished')
            AND created_at < NOW() - (${ROOM_TTL_MINUTES} * INTERVAL '1 minute')
          RETURNING id
        `;
        return fallbackResult.rows.length;
      } catch (fallbackError) {
        console.error('Fallback cleanup failed:', fallbackError);
      }
    }

    console.error('Error cleaning up expired rooms:', error);
    return 0;
  }
}

export async function createRoom(roomCode: string, hostName: string, avatar: string) {
  try {
    await cleanupExpiredRooms();

    const playerId = nanoid();
    const safeAvatar = normalizeAvatarUrl(avatar, hostName);

    await sql`
      INSERT INTO rooms (id, host_id, status, current_game, config)
      VALUES (${roomCode}, ${playerId}, 'waiting', 0, '{"rounds":[]}')
    `;

    await sql`
      INSERT INTO players (id, room_id, name, avatar, session_id, scores)
      VALUES (${playerId}, ${roomCode}, ${hostName}, ${safeAvatar}, ${playerId}, '{}')
    `;

    return { roomId: roomCode, playerId };
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

export async function joinRoom(roomCode: string, playerName: string, avatar: string) {
  try {
    await cleanupExpiredRooms();

    const room = await sql`
      SELECT * FROM rooms WHERE id = ${roomCode} AND status IN ('waiting', 'configuring')
    `;

    if (room.rows.length === 0) {
      throw new Error('Room not found or already started');
    }

    const playerCount = await sql`
      SELECT COUNT(*) as count FROM players WHERE room_id = ${roomCode}
    `;

    if (Number(playerCount.rows[0].count) >= 10) {
      throw new Error('Room is full (max 10 players)');
    }

    const existingPlayer = await sql`
      SELECT id FROM players WHERE room_id = ${roomCode} AND name = ${playerName}
    `;

    if (existingPlayer.rows.length > 0) {
      throw new Error('Name already taken in this room');
    }

    const playerId = nanoid();
    const safeAvatar = normalizeAvatarUrl(avatar, playerName);

    await sql`
      INSERT INTO players (id, room_id, name, avatar, session_id, scores)
      VALUES (${playerId}, ${roomCode}, ${playerName}, ${safeAvatar}, ${playerId}, '{}')
    `;

    return { roomId: roomCode, playerId };
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

export async function getRoom(roomCode: string): Promise<Room | null> {
  try {
    await cleanupExpiredRooms();

    const result = await sql`SELECT * FROM rooms WHERE id = ${roomCode}`;
    if (result.rows.length === 0) return null;

    const room = result.rows[0];
    const players = await getPlayers(roomCode);

    let config: RoomConfig = { rounds: [] };
    try {
      if (room.config) config = typeof room.config === 'string' ? JSON.parse(room.config) : room.config;
    } catch { /* fallback empty */ }

    return {
      id: room.id,
      hostId: room.host_id,
      status: room.status as RoomStatus,
      currentGame: room.current_game,
      players,
      config,
    };
  } catch (error) {
    console.error('Error getting room:', error);
    return null;
  }
}

type RoomListRow = {
  id: string;
  status: RoomStatus;
  current_game: number;
  created_at: string | Date;
  status_changed_at: string | Date;
  player_count: number;
};

export async function listRooms(): Promise<RoomListItem[]> {
  try {
    await cleanupExpiredRooms();

    const result = await sql<RoomListRow>`
      SELECT
        r.id,
        r.status,
        r.current_game,
        r.created_at,
        COALESCE(r.status_changed_at, r.created_at) AS status_changed_at,
        COUNT(p.id)::int AS player_count
      FROM rooms r
      LEFT JOIN players p ON p.room_id = r.id
      GROUP BY r.id, r.status, r.current_game, r.created_at, r.status_changed_at
      ORDER BY r.created_at DESC
    `;

    return result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      currentGame: Number(row.current_game) || 0,
      playerCount: Number(row.player_count) || 0,
      createdAt: new Date(row.created_at).toISOString(),
      statusChangedAt: new Date(row.status_changed_at).toISOString(),
    }));
  } catch (error) {
    if (isMissingStatusChangedAtColumn(error)) {
      try {
        const fallback = await sql<RoomListRow>`
          SELECT
            r.id,
            r.status,
            r.current_game,
            r.created_at,
            r.created_at AS status_changed_at,
            COUNT(p.id)::int AS player_count
          FROM rooms r
          LEFT JOIN players p ON p.room_id = r.id
          GROUP BY r.id, r.status, r.current_game, r.created_at
          ORDER BY r.created_at DESC
        `;

        return fallback.rows.map((row) => ({
          id: row.id,
          status: row.status,
          currentGame: Number(row.current_game) || 0,
          playerCount: Number(row.player_count) || 0,
          createdAt: new Date(row.created_at).toISOString(),
          statusChangedAt: new Date(row.status_changed_at).toISOString(),
        }));
      } catch (fallbackError) {
        console.error('Fallback room list failed:', fallbackError);
      }
    }

    console.error('Error listing rooms:', error);
    return [];
  }
}

type OfflineHandlingResult = {
  roomDeleted: boolean;
  playerDeleted: boolean;
  hostLeft: boolean;
};

export async function handlePlayerOffline(roomId: string, playerId: string): Promise<OfflineHandlingResult> {
  try {
    await cleanupExpiredRooms();

    const roomResult = await sql<{ id: string; host_id: string }>`
      SELECT id, host_id FROM rooms WHERE id = ${roomId}
    `;

    if (roomResult.rows.length === 0) {
      return { roomDeleted: false, playerDeleted: false, hostLeft: false };
    }

    const room = roomResult.rows[0];

    const playerResult = await sql<{ id: string }>`
      SELECT id FROM players WHERE id = ${playerId} AND room_id = ${roomId}
    `;

    if (playerResult.rows.length === 0) {
      return { roomDeleted: false, playerDeleted: false, hostLeft: false };
    }

    if (room.host_id === playerId) {
      await sql`DELETE FROM rooms WHERE id = ${roomId}`;
      return { roomDeleted: true, playerDeleted: true, hostLeft: true };
    }

    await sql`DELETE FROM players WHERE id = ${playerId} AND room_id = ${roomId}`;
    return { roomDeleted: false, playerDeleted: true, hostLeft: false };
  } catch (error) {
    console.error('Error handling player offline:', error);
    return { roomDeleted: false, playerDeleted: false, hostLeft: false };
  }
}

export async function getPlayers(roomCode: string): Promise<Player[]> {
  try {
    const result = await sql`
      SELECT * FROM players WHERE room_id = ${roomCode} ORDER BY joined_at ASC
    `;

    return result.rows.map((row) => {
      let scores: Record<string, number> = {};
      try {
        if (row.scores) scores = typeof row.scores === 'string' ? JSON.parse(row.scores) : row.scores;
      } catch { /* fallback empty */ }

      // Also read legacy columns if present
      const legacyScores: Record<string, number> = {};
      for (let i = 1; i <= 5; i++) {
        const v = row[`game${i}_score`];
        if (v && Number(v) !== 0) legacyScores[`round_${i}`] = Number(v);
      }

      const merged = { ...legacyScores, ...scores };

      return {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        totalScore: row.total_score || 0,
        gameScores: merged,
      };
    });
  } catch (error) {
    console.error('Error getting players:', error);
    return [];
  }
}

// ==================== GAME OPERATIONS ====================

export async function updateRoomStatus(roomCode: string, status: RoomStatus, currentGame?: number) {
  try {
    await ensureRoomLifecycleSchema();

    if (currentGame !== undefined) {
      await sql`
        UPDATE rooms
        SET
          status = ${status},
          current_game = ${currentGame},
          status_changed_at = CASE
            WHEN status <> ${status} THEN NOW()
            ELSE COALESCE(status_changed_at, created_at, NOW())
          END
        WHERE id = ${roomCode}
      `;
    } else {
      await sql`
        UPDATE rooms
        SET
          status = ${status},
          status_changed_at = CASE
            WHEN status <> ${status} THEN NOW()
            ELSE COALESCE(status_changed_at, created_at, NOW())
          END
        WHERE id = ${roomCode}
      `;
    }
  } catch (error) {
    if (isMissingStatusChangedAtColumn(error)) {
      if (currentGame !== undefined) {
        await sql`
          UPDATE rooms SET status = ${status}, current_game = ${currentGame} WHERE id = ${roomCode}
        `;
      } else {
        await sql`UPDATE rooms SET status = ${status} WHERE id = ${roomCode}`;
      }
      return;
    }

    console.error('Error updating room status:', error);
    throw error;
  }
}

export async function saveRoomConfig(roomCode: string, config: RoomConfig) {
  try {
    await ensureRoomLifecycleSchema();

    const configStr = JSON.stringify(config);
    await sql`
      UPDATE rooms
      SET
        config = ${configStr},
        status = 'configuring',
        status_changed_at = CASE
          WHEN status <> 'configuring' THEN NOW()
          ELSE COALESCE(status_changed_at, created_at, NOW())
        END
      WHERE id = ${roomCode}
    `;
  } catch (error) {
    if (isMissingStatusChangedAtColumn(error)) {
      const configStr = JSON.stringify(config);
      await sql`UPDATE rooms SET config = ${configStr}, status = 'configuring' WHERE id = ${roomCode}`;
      return;
    }

    console.error('Error saving room config:', error);
    throw error;
  }
}

export async function updatePlayerScore(playerId: string, roundKey: string, score: number) {
  try {
    // Read current scores JSON
    const result = await sql`SELECT scores, total_score FROM players WHERE id = ${playerId}`;
    if (result.rows.length === 0) return;

    let scores: Record<string, number> = {};
    try {
      const raw = result.rows[0].scores;
      if (raw) scores = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { /* fallback */ }

    scores[roundKey] = score;
    const total = Object.values(scores).reduce((s, v) => s + v, 0);
    const scoresStr = JSON.stringify(scores);

    await sql`
      UPDATE players SET scores = ${scoresStr}, total_score = ${total} WHERE id = ${playerId}
    `;
  } catch (error) {
    console.error('Error updating player score:', error);
    throw error;
  }
}

// ==================== UTILITY FUNCTIONS ====================

export function generateRoomCode(): string {
  const chars = '234567890ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

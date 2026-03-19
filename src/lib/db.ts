// Database helper functions using Vercel Postgres – Modular Architecture

import { sql } from '@vercel/postgres';
import { nanoid } from 'nanoid';
import { Room, Player, RoomConfig } from '@/types';

// ==================== ROOM OPERATIONS ====================

export async function createRoom(roomCode: string, hostName: string) {
  try {
    const playerId = nanoid();

    await sql`
      INSERT INTO rooms (id, host_id, status, current_game, config)
      VALUES (${roomCode}, ${playerId}, 'waiting', 0, '{"rounds":[]}')
    `;

    await sql`
      INSERT INTO players (id, room_id, name, avatar, session_id, scores)
      VALUES (${playerId}, ${roomCode}, ${hostName}, '👑', ${playerId}, '{}')
    `;

    return { roomId: roomCode, playerId };
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

export async function joinRoom(roomCode: string, playerName: string) {
  try {
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
    const avatars = ['😀', '😎', '🤓', '😊', '🥳', '🤪', '😇', '🤠', '🦊', '🐻'];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    await sql`
      INSERT INTO players (id, room_id, name, avatar, session_id, scores)
      VALUES (${playerId}, ${roomCode}, ${playerName}, ${randomAvatar}, ${playerId}, '{}')
    `;

    return { roomId: roomCode, playerId };
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

export async function getRoom(roomCode: string): Promise<Room | null> {
  try {
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
      status: room.status,
      currentGame: room.current_game,
      players,
      config,
    };
  } catch (error) {
    console.error('Error getting room:', error);
    return null;
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

export async function updateRoomStatus(roomCode: string, status: string, currentGame?: number) {
  try {
    if (currentGame !== undefined) {
      await sql`
        UPDATE rooms SET status = ${status}, current_game = ${currentGame} WHERE id = ${roomCode}
      `;
    } else {
      await sql`UPDATE rooms SET status = ${status} WHERE id = ${roomCode}`;
    }
  } catch (error) {
    console.error('Error updating room status:', error);
    throw error;
  }
}

export async function saveRoomConfig(roomCode: string, config: RoomConfig) {
  try {
    const configStr = JSON.stringify(config);
    await sql`UPDATE rooms SET config = ${configStr}, status = 'configuring' WHERE id = ${roomCode}`;
  } catch (error) {
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

// Database helper functions using Vercel Postgres

import { sql } from '@vercel/postgres';
import { nanoid } from 'nanoid';
import { Room, Player } from '@/types';

// ==================== ROOM OPERATIONS ====================

export async function createRoom(roomCode: string, hostName: string) {
  try {
    // Generate playerId first
    const playerId = nanoid();

    // Create room
    await sql`
      INSERT INTO rooms (id, host_id, status, current_game)
      VALUES (${roomCode}, ${playerId}, 'waiting', 0)
    `;

    // Create host player with session_id
    await sql`
      INSERT INTO players (id, room_id, name, avatar, session_id)
      VALUES (${playerId}, ${roomCode}, ${hostName}, '👑', ${playerId})
    `;

    return { roomId: roomCode, playerId };
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
}

export async function joinRoom(roomCode: string, playerName: string) {
  try {
    // Check if room exists and is waiting
    const room = await sql`
      SELECT * FROM rooms WHERE id = ${roomCode} AND status = 'waiting'
    `;

    if (room.rows.length === 0) {
      throw new Error('Room not found or already started');
    }

    // Check player count
    const playerCount = await sql`
      SELECT COUNT(*) as count FROM players WHERE room_id = ${roomCode}
    `;

    if (Number(playerCount.rows[0].count) >= 10) {
      throw new Error('Room is full (max 10 players)');
    }

    // Check duplicate name
    const existingPlayer = await sql`
      SELECT id FROM players WHERE room_id = ${roomCode} AND name = ${playerName}
    `;

    if (existingPlayer.rows.length > 0) {
      throw new Error('Name already taken in this room');
    }

    // Add player
    const playerId = nanoid();
    const avatars = ['😀', '😎', '🤓', '😊', '🥳', '🤪', '😇', '🤠'];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    await sql`
      INSERT INTO players (id, room_id, name, avatar, session_id)
      VALUES (${playerId}, ${roomCode}, ${playerName}, ${randomAvatar}, ${playerId})
    `;

    return { roomId: roomCode, playerId };
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
}

export async function getRoom(roomCode: string): Promise<Room | null> {
  try {
    const result = await sql`
      SELECT * FROM rooms WHERE id = ${roomCode}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const room = result.rows[0];
    const players = await getPlayers(roomCode);

    return {
      id: room.id,
      hostId: room.host_id,
      status: room.status,
      currentGame: room.current_game,
      players,
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

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      totalScore: row.total_score || 0,
      gameScores: {
        game1: row.game1_score || 0,
        game2: row.game2_score || 0,
        game3: row.game3_score || 0,
        game4: row.game4_score || 0,
        game5: row.game5_score || 0,
      },
    }));
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
        UPDATE rooms 
        SET status = ${status}, current_game = ${currentGame}
        WHERE id = ${roomCode}
      `;
    } else {
      await sql`
        UPDATE rooms 
        SET status = ${status}
        WHERE id = ${roomCode}
      `;
    }
  } catch (error) {
    console.error('Error updating room status:', error);
    throw error;
  }
}

export async function updatePlayerScore(playerId: string, game: number, score: number) {
  try {
    const column = `game${game}_score`;
    
    // First update the specific game score
    await sql.query(`
      UPDATE players 
      SET ${column} = $1
      WHERE id = $2
    `, [score, playerId]);

    // Then recalculate total_score from the now-updated values
    await sql`
      UPDATE players 
      SET total_score = COALESCE(game1_score, 0) + COALESCE(game2_score, 0) + COALESCE(game3_score, 0) + COALESCE(game4_score, 0) + COALESCE(game5_score, 0)
      WHERE id = ${playerId}
    `;
  } catch (error) {
    console.error('Error updating player score:', error);
    throw error;
  }
}

// ==================== UTILITY FUNCTIONS ====================

export function generateRoomCode(): string {
  // Generate 6-character code, excluding confusing characters (0, O, 1, I, L)
  const chars = '234567890ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

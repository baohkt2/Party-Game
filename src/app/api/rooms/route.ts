// POST /api/rooms - Tạo phòng mới

import { NextRequest, NextResponse } from 'next/server';
import { createRoom, generateRoomCode } from '@/lib/db';
import { pusherServer, PUSHER_EVENTS } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const { hostName } = await request.json();

    // Validate input
    if (!hostName || hostName.trim().length < 2 || hostName.trim().length > 15) {
      return NextResponse.json(
        { error: 'Tên phải từ 2-15 ký tự' },
        { status: 400 }
      );
    }

    // Generate unique room code
    const roomCode = generateRoomCode();

    // Create room and host player
    const { roomId, playerId } = await createRoom(roomCode, hostName.trim());

    return NextResponse.json({
      success: true,
      data: { roomId, playerId },
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Không thể tạo phòng. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}

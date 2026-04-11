// POST /api/rooms - Tạo phòng mới

import { NextRequest, NextResponse } from 'next/server';
import { createRoom, generateRoomCode, listRooms } from '@/lib/db';
import { normalizeAvatarUrl } from '@/lib/avatar';

export async function POST(request: NextRequest) {
  try {
    const { hostName, avatar } = await request.json();

    // Validate input
    if (!hostName || hostName.trim().length < 2 || hostName.trim().length > 15) {
      return NextResponse.json(
        { error: 'Tên phải từ 2-15 ký tự' },
        { status: 400 }
      );
    }

    // Generate unique room code
    const roomCode = generateRoomCode();
    const normalizedAvatar = normalizeAvatarUrl(avatar, hostName.trim());

    // Create room and host player
    const { roomId, playerId } = await createRoom(roomCode, hostName.trim(), normalizedAvatar);

    return NextResponse.json({
      success: true,
      data: { roomId, playerId, avatar: normalizedAvatar },
    });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Không thể tạo phòng. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const rooms = await listRooms();

    return NextResponse.json({
      success: true,
      data: { rooms },
    });
  } catch (error) {
    console.error('Error listing rooms:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách phòng' },
      { status: 500 }
    );
  }
}

// POST /api/rooms/join - Tham gia phòng

import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/db';
import { pusherServer, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const { roomCode, playerName } = await request.json();

    // Validate input
    if (!roomCode || roomCode.length !== 6) {
      return NextResponse.json(
        { error: 'Mã phòng không hợp lệ' },
        { status: 400 }
      );
    }

    if (!playerName || playerName.trim().length < 2 || playerName.trim().length > 15) {
      return NextResponse.json(
        { error: 'Tên phải từ 2-15 ký tự' },
        { status: 400 }
      );
    }

    // Join room
    const { roomId, playerId } = await joinRoom(
      roomCode.toUpperCase(),
      playerName.trim()
    );

    // Trigger Pusher event to notify other players
    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, PUSHER_EVENTS.PLAYER_JOINED, {
      playerId,
      playerName: playerName.trim(),
    });

    return NextResponse.json({
      success: true,
      data: { roomId, playerId },
    });
  } catch (error) {
    console.error('Error joining room:', error);
    
    // Handle specific errors
    const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
    
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { error: 'Phòng không tồn tại hoặc đã bắt đầu' },
        { status: 404 }
      );
    }
    
    if (errorMessage.includes('full')) {
      return NextResponse.json(
        { error: 'Phòng đã đầy (tối đa 10 người)' },
        { status: 400 }
      );
    }
    
    if (errorMessage.includes('already taken')) {
      return NextResponse.json(
        { error: 'Tên này đã có người dùng trong phòng' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Không thể tham gia phòng. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}

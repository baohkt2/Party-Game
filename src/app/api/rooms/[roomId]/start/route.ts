// POST /api/rooms/[roomId]/start - Bắt đầu game (chỉ host)

import { NextRequest, NextResponse } from 'next/server';
import { updateRoomStatus, getPlayers, getRoom } from '@/lib/db';
import { pusherServer, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId } = await request.json();

    // Get room
    const room = await getRoom(roomId);
    
    if (!room) {
      return NextResponse.json(
        { error: 'Phòng không tồn tại' },
        { status: 404 }
      );
    }

    // Validate: caller is host
    if (room.hostId !== playerId) {
      return NextResponse.json(
        { error: 'Chỉ host mới có thể bắt đầu game' },
        { status: 403 }
      );
    }

    // Get players count
    const players = await getPlayers(roomId);
    
    if (players.length < 2) {
      return NextResponse.json(
        { error: 'Cần ít nhất 2 người chơi' },
        { status: 400 }
      );
    }

    // Update room status
    await updateRoomStatus(roomId, 'playing', 1);

    // Trigger Pusher event
    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, PUSHER_EVENTS.GAME_STARTED, {
      currentGame: 1,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Game đã bắt đầu!' },
    });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json(
      { error: 'Không thể bắt đầu game' },
      { status: 500 }
    );
  }
}

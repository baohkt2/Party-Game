import { NextRequest, NextResponse } from 'next/server';
import { getRoom, updateRoomStatus } from '@/lib/db';
import { pusherServer, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    // Get current room state
    const room = await getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    }

    // Advance to next game
    const nextGame = room.currentGame + 1;
    let status = 'playing';
    if (nextGame > 5) {
       status = 'finished'; // Game over after round 5
    }

    await updateRoomStatus(roomId, status, nextGame);

    // Trigger Pusher event
    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, PUSHER_EVENTS.GAME_UPDATE, {
      currentGame: nextGame,
    });

    return NextResponse.json({
      success: true,
      data: { currentGame: nextGame },
    });
  } catch (error) {
    console.error('Error advancing game:', error);
    return NextResponse.json(
      { error: 'Lỗi khi chuyển trò chơi' },
      { status: 500 }
    );
  }
}

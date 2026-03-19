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

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    if (room.hostId !== playerId) return NextResponse.json({ error: 'Chỉ host mới có thể bắt đầu' }, { status: 403 });

    const players = await getPlayers(roomId);
    if (players.length < 2) return NextResponse.json({ error: 'Cần ít nhất 2 người chơi' }, { status: 400 });

    // Validate config
    if (!room.config || room.config.rounds.length === 0) {
      return NextResponse.json({ error: 'Chưa cấu hình game' }, { status: 400 });
    }

    await updateRoomStatus(roomId, 'playing', 1);

    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, PUSHER_EVENTS.GAME_STARTED, {
      currentGame: 1,
      config: room.config,
    });

    return NextResponse.json({ success: true, data: { message: 'Game đã bắt đầu!' } });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json({ error: 'Không thể bắt đầu game' }, { status: 500 });
  }
}

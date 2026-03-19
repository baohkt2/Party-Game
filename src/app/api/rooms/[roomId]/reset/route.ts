import { NextRequest, NextResponse } from 'next/server';
import { getRoom, updateRoomStatus } from '@/lib/db';
import { pusherServer, getRoomChannel } from '@/lib/pusher';
import { sql } from '@vercel/postgres';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId } = await request.json();

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    if (room.hostId !== playerId) return NextResponse.json({ error: 'Chỉ host mới có thể reset' }, { status: 403 });

    await updateRoomStatus(roomId, 'waiting', 0);

    // Reset all player scores
    await sql`UPDATE players SET scores = '{}', total_score = 0 WHERE room_id = ${roomId}`;

    // Also reset config
    await sql`UPDATE rooms SET config = '{"rounds":[]}' WHERE id = ${roomId}`;

    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, 'game-reset', { roomId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting game:', error);
    return NextResponse.json({ error: 'Không thể reset game' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { updatePlayerScore, getPlayers } from '@/lib/db';
import { pusherServer, PUSHER_EVENTS, getRoomChannel } from '@/lib/pusher';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId, gameNumber, score } = await request.json();

    await updatePlayerScore(playerId, gameNumber, score);

    // Fetch updated players to broadcast
    const updatedPlayers = await getPlayers(roomId);
    const channel = getRoomChannel(roomId);
    
    await pusherServer.trigger(channel, PUSHER_EVENTS.SCORE_UPDATE, {
      players: updatedPlayers,
    });

    return NextResponse.json({ success: true, data: updatedPlayers });
  } catch (error) {
    console.error('Error updating score:', error);
    return NextResponse.json(
      { error: 'Lỗi khi cập nhật điểm' },
      { status: 500 }
    );
  }
}

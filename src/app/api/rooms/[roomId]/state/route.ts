import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getPlayers } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await getRoom(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    }

    const players = await getPlayers(roomId);

    return NextResponse.json({
      success: true,
      data: {
        status: room.status,
        currentGame: room.currentGame,
        players,
        hostId: room.hostId,
        config: room.config || { rounds: [] },
      },
    });
  } catch (error) {
    console.error('Error getting room state:', error);
    return NextResponse.json({ error: 'Không thể lấy trạng thái phòng' }, { status: 500 });
  }
}

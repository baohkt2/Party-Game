// GET /api/rooms/[roomId]/players - Lấy danh sách người chơi

import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, getRoom } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;

    // Get room info
    const room = await getRoom(roomId);
    
    if (!room) {
      return NextResponse.json(
        { error: 'Phòng không tồn tại' },
        { status: 404 }
      );
    }

    // Get players
    const players = await getPlayers(roomId);

    return NextResponse.json({
      success: true,
      data: {
        players,
        hostId: room.hostId,
        status: room.status,
      },
    });
  } catch (error) {
    console.error('Error getting players:', error);
    return NextResponse.json(
      { error: 'Không thể lấy danh sách người chơi' },
      { status: 500 }
    );
  }
}

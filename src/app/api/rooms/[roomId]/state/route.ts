// GET /api/rooms/[roomId]/state - Lấy trạng thái game hiện tại

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, getPlayers } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Get room
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
        status: room.status,
        currentGame: room.currentGame,
        players,
        hostId: room.hostId,
      },
    });
  } catch (error) {
    console.error('Error getting room state:', error);
    return NextResponse.json(
      { error: 'Không thể lấy trạng thái phòng' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoomConfig } from '@/lib/db';
import { pusherServer, getRoomChannel } from '@/lib/pusher';
import { RoomConfig } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId, config } = await request.json() as { playerId: string, config: RoomConfig };

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    if (room.hostId !== playerId) return NextResponse.json({ error: 'Chỉ host mới có thể cấu hình' }, { status: 403 });

    await saveRoomConfig(roomId, config);

    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, 'config-updated', { config });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json({ error: 'Lỗi khi lưu cấu hình' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    return NextResponse.json({ success: true, data: { config: room.config } });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi' }, { status: 500 });
  }
}

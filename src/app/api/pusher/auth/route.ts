import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getRoom } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';

type AuthPayload = {
  socket_id: string;
  channel_name: string;
  playerId?: string;
  playerName?: string;
  playerAvatar?: string;
  roomId?: string;
};

async function parseAuthPayload(request: NextRequest): Promise<AuthPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  const formData = await request.formData();
  return {
    socket_id: String(formData.get('socket_id') || ''),
    channel_name: String(formData.get('channel_name') || ''),
    playerId: String(formData.get('playerId') || ''),
    playerName: String(formData.get('playerName') || ''),
    playerAvatar: String(formData.get('playerAvatar') || ''),
    roomId: String(formData.get('roomId') || ''),
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      socket_id,
      channel_name,
      playerId,
      playerName,
      playerAvatar,
      roomId,
    } = await parseAuthPayload(request);

    if (!socket_id || !channel_name || !playerId) {
      return NextResponse.json({ error: 'Thiếu dữ liệu xác thực channel' }, { status: 400 });
    }

    if (typeof channel_name !== 'string' || !channel_name.startsWith('presence-room-')) {
      return NextResponse.json({ error: 'Channel presence không hợp lệ' }, { status: 403 });
    }

    const channelRoomId = channel_name.replace('presence-room-', '');
    if (roomId && roomId !== channelRoomId) {
      return NextResponse.json({ error: 'Room không khớp với channel' }, { status: 403 });
    }

    const room = await getRoom(channelRoomId);
    if (!room) {
      return NextResponse.json({ error: 'Phòng không tồn tại' }, { status: 404 });
    }

    const playerResult = await sql<{ id: string; name: string; avatar: string }>`
      SELECT id, name, avatar
      FROM players
      WHERE id = ${playerId} AND room_id = ${channelRoomId}
      LIMIT 1
    `;

    if (playerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Người chơi không thuộc phòng này' }, { status: 403 });
    }

    const player = playerResult.rows[0];
    const authResponse = pusherServer.authorizeChannel(socket_id, channel_name, {
      user_id: player.id,
      user_info: {
        name: playerName || player.name,
        avatar: playerAvatar || player.avatar,
      },
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Error authorizing Pusher channel:', error);
    return NextResponse.json({ error: 'Không thể xác thực Pusher channel' }, { status: 500 });
  }
}

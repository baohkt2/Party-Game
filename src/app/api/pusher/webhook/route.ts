import { NextRequest, NextResponse } from 'next/server';
import { handlePlayerOffline } from '@/lib/db';
import { getRoomChannel, pusherServer, PUSHER_EVENTS } from '@/lib/pusher';

type PusherWebhookEvent = {
  name?: string;
  channel?: string;
  data?: string;
  user_id?: string;
};

function normalizeHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function extractPlayerId(event: PusherWebhookEvent): string | null {
  if (event.user_id) return event.user_id;

  if (typeof event.data === 'string') {
    try {
      const parsed = JSON.parse(event.data) as { user_id?: string };
      if (parsed.user_id) return parsed.user_id;
    } catch {
      return null;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const webhook = pusherServer.webhook({
      headers: normalizeHeaders(request.headers),
      rawBody,
    });

    if (!webhook.isValid()) {
      return NextResponse.json({ error: 'Webhook signature không hợp lệ' }, { status: 401 });
    }

    const events = webhook.getEvents() as PusherWebhookEvent[];

    for (const event of events) {
      if (event.name !== 'member_removed') continue;
      if (!event.channel || !event.channel.startsWith('presence-room-')) continue;

      const roomId = event.channel.replace('presence-room-', '');
      const playerId = extractPlayerId(event);
      if (!playerId) continue;

      const result = await handlePlayerOffline(roomId, playerId);
      if (!result.playerDeleted && !result.roomDeleted) continue;

      const roomChannel = getRoomChannel(roomId);
      if (result.hostLeft || result.roomDeleted) {
        await pusherServer.trigger(roomChannel, PUSHER_EVENTS.ROOM_CLOSED, {
          roomId,
          hostId: playerId,
          reason: 'host-offline',
        });
      } else {
        await pusherServer.trigger(roomChannel, PUSHER_EVENTS.PLAYER_LEFT, {
          roomId,
          playerId,
          reason: 'player-offline',
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Pusher webhook:', error);
    return NextResponse.json({ error: 'Không thể xử lý webhook' }, { status: 500 });
  }
}

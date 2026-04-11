'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getSessionPlayerId } from '@/lib/clientSession';
import { getPresenceRoomChannel, pusherClient } from '@/lib/pusher';

function extractRoomIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  const roomRoutes = new Set(['lobby', 'config', 'game']);
  if (!roomRoutes.has(segments[0])) return null;

  return segments[1];
}

export default function RoomPresenceTracker() {
  const pathname = usePathname();
  const activeChannelRef = useRef<string | null>(null);

  const roomId = useMemo(() => extractRoomIdFromPath(pathname), [pathname]);

  useEffect(() => {
    const playerId = getSessionPlayerId();

    if (!roomId || !playerId) {
      if (activeChannelRef.current) {
        pusherClient.unsubscribe(activeChannelRef.current);
        activeChannelRef.current = null;
      }
      return;
    }

    const channelName = getPresenceRoomChannel(roomId);
    if (activeChannelRef.current === channelName) return;

    if (activeChannelRef.current) {
      pusherClient.unsubscribe(activeChannelRef.current);
    }

    pusherClient.subscribe(channelName);
    activeChannelRef.current = channelName;
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (activeChannelRef.current) {
        pusherClient.unsubscribe(activeChannelRef.current);
        activeChannelRef.current = null;
      }
    };
  }, []);

  return null;
}

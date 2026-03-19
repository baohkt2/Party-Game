import { NextRequest, NextResponse } from 'next/server';
import { pusherServer, getRoomChannel } from '@/lib/pusher';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { event, data } = body;

    const channel = getRoomChannel(roomId);
    await pusherServer.trigger(channel, event, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error broadcasting action:', error);
    return NextResponse.json(
      { error: 'Lỗi khi gửi hành động' },
      { status: 500 }
    );
  }
}

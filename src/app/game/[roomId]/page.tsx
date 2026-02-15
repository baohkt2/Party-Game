'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function GamePage({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const { roomId } = params;

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-500 to-purple-600 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <Card className="p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">🎮 Game Page</h1>
          <p className="text-gray-600 mb-6">
            Phòng: <span className="font-mono font-bold">{roomId}</span>
          </p>
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
            <p className="text-yellow-800 font-semibold">
              🚧 Đang phát triển...
            </p>
            <p className="text-sm text-yellow-700 mt-2">
              Game page sẽ được xây dựng ở Giai đoạn 3-6
            </p>
          </div>
          <Button
            onClick={() => router.push(`/lobby/${roomId}`)}
            size="lg"
          >
            ← Quay lại lobby
          </Button>
        </Card>
      </div>
    </div>
  );
}

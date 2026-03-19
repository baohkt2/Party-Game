'use client';

import { useState, useEffect } from 'react';
import { Player, GamePhase } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { toast } from 'sonner';

interface GameProps {
  roomId: string;
  players: Player[];
  isHost: boolean;
}

interface RequestItem {
  playerId: string;
  text: string;
}

export default function Game2Roulette({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<GamePhase['wheel']>('submit');
  const [myRequests, setMyRequests] = useState(['', '', '']);
  const [allRequests, setAllRequests] = useState<RequestItem[]>([]);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);
  
  // States for spin
  const [spinning, setSpinning] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('roulette-submit', (data: { playerId: string, requests: RequestItem[] }) => {
      setSubmittedPlayers(prev => prev.includes(data.playerId) ? prev : [...prev, data.playerId]);
      setAllRequests(prev => [...prev, ...data.requests]);
    });

    channel.bind('roulette-spin', (data: { request: RequestItem, playerToPerform: Player }) => {
      setPhase('spin');
      setSpinning(true);
      setTimeout(() => {
        setSelectedRequest(data.request);
        setSelectedPlayer(data.playerToPerform);
        setSpinning(false);
        setPhase('challenge');
      }, 3000); // 3s spin animation delay
    });

    channel.bind('roulette-judge', () => {
      setPhase('submit'); // Allow next spin
    });

    return () => {
      channel.unbind('roulette-submit');
      channel.unbind('roulette-spin');
      // No unbind judge
    };
  }, [roomId]);

  const submitRequests = async () => {
    if (myRequests.some(r => r.trim() === '')) {
      toast.error('Vui lòng điền đủ 3 yêu cầu');
      return;
    }

    const payload = myRequests.map(text => ({ playerId: myId!, text }));
    
    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'roulette-submit', 
        data: { playerId: myId, requests: payload } 
      }),
    });
    
    toast.success('Đã gửi yêu cầu!');
  };

  const spinWheel = async () => {
    if (allRequests.length === 0) {
      toast.error('Chưa có yêu cầu nào được gửi!');
      return;
    }

    const randomRequest = allRequests[Math.floor(Math.random() * allRequests.length)];
    const randomPlayer = players[Math.floor(Math.random() * players.length)];

    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'roulette-spin', 
        data: { request: randomRequest, playerToPerform: randomPlayer } 
      }),
    });
  };

  const handleDisplayResult = async (success: boolean) => {
    if (!selectedPlayer) return;

    // +3 điểm nếu thành công, -1 nếu thất bại
    const currentScore = selectedPlayer.gameScores?.game2 || 0;
    const newScore = success ? currentScore + 3 : currentScore - 1;

    await fetch(`/api/rooms/${roomId}/game/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        playerId: selectedPlayer.id,
        gameNumber: 2,
        score: newScore
      }),
    });

    if (!success) {
      toast.error(`${selectedPlayer.name} bị phạt uống 1/2 ly bia!`);
    } else {
      toast.success(`${selectedPlayer.name} nhận được 3 điểm!`);
    }

    await fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'roulette-judge', data: {} }),
    });
  };

  if (phase === 'submit') {
    return (
      <Card className="p-8 max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-4 text-center">Vòng 2: Hại Người - Hại Mình</h2>
        
        {!submittedPlayers.includes(myId!) ? (
          <div className="space-y-4">
            <p className="text-gray-600 mb-4 text-center">Hãy viết ra 3 hành động (Dare) bạn muốn người khác làm.</p>
            {myRequests.map((req, idx) => (
              <Input 
                key={idx}
                placeholder={`Yêu cầu ${idx + 1}`}
                value={req}
                onChange={(e) => {
                  const curr = [...myRequests];
                  curr[idx] = e.target.value;
                  setMyRequests(curr);
                }}
              />
            ))}
            <Button className="w-full mt-4" onClick={submitRequests}>Gửi Yêu Cầu</Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="text-xl">✅ Đặc gửi yêu cầu thành công!</div>
            <p className="text-gray-600">
              Đã có {submittedPlayers.length}/{players.length} người gửi.
            </p>
            {isHost && (
              <Button size="lg" className="mt-6 w-full" onClick={spinWheel} disabled={allRequests.length === 0}>
                Quay Trừng Phạt
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  }

  if (phase === 'spin') {
    return (
      <Card className="p-12 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-4xl font-bold mb-8 animate-pulse text-purple-600">Đang quay... 🎲</h2>
        <div className="text-xl">Đang chọn nạn nhân và hình phạt...</div>
      </Card>
    );
  }

  if (phase === 'challenge' && selectedPlayer && selectedRequest) {
    const author = players.find(p => p.id === selectedRequest.playerId)?.name || 'Ẩn danh';

    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-2">🎯 Người thực hiện:</h2>
        <p className="text-4xl font-black mb-8">{selectedPlayer.name}</p>

        <div className="bg-orange-50 border p-6 rounded-xl mb-8">
          <p className="text-gray-500 text-sm mb-2">Yêu cầu từ: {author}</p>
          <p className="text-2xl font-semibold">&quot;{selectedRequest.text}&quot;</p>
        </div>

        {isHost && (
          <div className="flex gap-4 justify-center mt-6">
            <Button onClick={() => handleDisplayResult(true)} className="bg-green-600 hover:bg-green-700">
              Thành Công (+3 điểm)
            </Button>
            <Button onClick={() => handleDisplayResult(false)} variant="destructive">
              Thất Bại (-1 điểm & Phạt)
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return null;
}

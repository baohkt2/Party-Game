'use client';

import { useState, useEffect, useRef } from 'react';
import { GamePhase } from '@/types';
import { Player } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { getSessionPlayerId } from '@/lib/clientSession';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { toast } from 'sonner';
import { GameProps } from '@/lib/gameRegistry';

interface RequestItem {
  playerId: string;
  text: string;
}

type RoulettePhase = GamePhase['wheel'] | 'result';

export default function Game2Roulette({ roomId, players, isHost }: GameProps) {
  const [phase, setPhase] = useState<RoulettePhase>('submit');
  const [myRequests, setMyRequests] = useState(['', '', '']);
  const [allRequests, setAllRequests] = useState<RequestItem[]>([]);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);

  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Spinning wheel states
  const [spinningPlayer, setSpinningPlayer] = useState<number>(0);
  const [spinningRequest, setSpinningRequest] = useState<number>(0);
  const spinTimerRef = useRef<NodeJS.Timeout>(null);

  // Voting states
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [voteResult, setVoteResult] = useState<{ success: boolean, yesCount: number, noCount: number } | null>(null);

  const myId = getSessionPlayerId();

  useEffect(() => {
    const channelName = getRoomChannel(roomId);
    const channel = pusherClient.subscribe(channelName);

    channel.bind('roulette-submit', (data: { playerId: string, requests: RequestItem[] }) => {
      setSubmittedPlayers(prev => prev.includes(data.playerId) ? prev : [...prev, data.playerId]);
      setAllRequests(prev => [...prev, ...data.requests]);
    });

    channel.bind('roulette-spin', (data: { request: RequestItem, playerToPerform: Player, playerIdx: number, requestIdx: number }) => {
      setPhase('spin');
      setVotes({});
      setMyVote(null);
      setVoteResult(null);

      // Animate spinning effect
      let tick = 0;
      const totalTicks = 10;
      const intervalBase = 10;

      const animateSpin = () => {
        if (tick < totalTicks) {
          setSpinningPlayer(Math.floor(Math.random() * players.length));
          setSpinningRequest(Math.floor(Math.random() * Math.max(1, allRequests.length)));
          tick++;
          // Slow down gradually
          const delay = intervalBase + (tick * tick * 2);
          spinTimerRef.current = setTimeout(animateSpin, delay);
        } else {
          // Land on final selection
          setSelectedRequest(data.request);
          setSelectedPlayer(data.playerToPerform);
          setPhase('challenge');
        }
      };
      animateSpin();
    });

    channel.bind('roulette-vote', (data: { voterId: string, success: boolean }) => {
      setVotes(prev => ({ ...prev, [data.voterId]: data.success }));
    });

    channel.bind('roulette-result', (data: { success: boolean, yesCount: number, noCount: number }) => {
      setVoteResult(data);
      setPhase('result');
    });

    channel.bind('roulette-next', () => {
      setPhase('submit');
      setSelectedPlayer(null);
      setSelectedRequest(null);
      setVotes({});
      setMyVote(null);
      setVoteResult(null);
    });

    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      channel.unbind('roulette-submit');
      channel.unbind('roulette-spin');
      channel.unbind('roulette-vote');
      channel.unbind('roulette-result');
      channel.unbind('roulette-next');
    };
  }, [roomId, players.length, allRequests.length]);

  // Host auto-tally votes
  useEffect(() => {
    if (!isHost || phase !== 'challenge' || !selectedPlayer) return;
    const eligibleVoters = players.filter(p => p.id !== selectedPlayer.id).length;
    if (Object.keys(votes).length < eligibleVoters) return;

    const yesCount = Object.values(votes).filter(v => v).length;
    const noCount = Object.values(votes).filter(v => !v).length;
    const success = yesCount > noCount;

    const currentScore = selectedPlayer.gameScores?.game2 || 0;
    const newScore = success ? currentScore + 3 : currentScore - 1;

    fetch(`/api/rooms/${roomId}/game/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: selectedPlayer.id, gameNumber: 2, score: newScore }),
    });

    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'roulette-result', data: { success, yesCount, noCount } }),
    });
  }, [votes, isHost, phase, selectedPlayer, players, roomId]);

  const submitRequests = () => {
    if (myRequests.some(r => r.trim() === '')) {
      toast.error('Vui lòng điền đủ 3 yêu cầu');
      return;
    }
    const payload = myRequests.map(text => ({ playerId: myId, text }));
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'roulette-submit', data: { playerId: myId, requests: payload } }),
    });
    toast.success('Đã gửi yêu cầu!');
  };

  const spinWheel = () => {
    if (allRequests.length === 0) { toast.error('Chưa có yêu cầu nào!'); return; }
    const requestIdx = Math.floor(Math.random() * allRequests.length);
    const playerIdx = Math.floor(Math.random() * players.length);
    const randomRequest = allRequests[requestIdx];
    const randomPlayer = players[playerIdx];
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'roulette-spin',
        data: { request: randomRequest, playerToPerform: randomPlayer, playerIdx, requestIdx }
      }),
    });
  };

  const castVote = (success: boolean) => {
    if (myVote !== null) return;
    setMyVote(success);
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'roulette-vote', data: { voterId: myId, success } }),
    });
  };

  const nextRound = () => {
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'roulette-next', data: {} }),
    });
  };

  if (phase === 'submit') {
    return (
      <Card className="p-8 max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-4 text-center">Vòng 2: Hại Người - Hại Mình</h2>
        {!(myId ? submittedPlayers.includes(myId) : false) ? (
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
            <div className="text-xl">✅ Đã gửi yêu cầu thành công!</div>
            <p className="text-gray-600">Đã có {submittedPlayers.length}/{players.length} người gửi.</p>
            {isHost && (
              <Button size="lg" className="mt-6 w-full" onClick={spinWheel} disabled={allRequests.length === 0}>
                🎲 Quay Vòng Quay
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  }

  if (phase === 'spin') {
    const displayPlayer = players[spinningPlayer % players.length];
    const displayRequest = allRequests.length > 0 ? allRequests[spinningRequest % allRequests.length] : null;

    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full overflow-hidden">
        <h2 className="text-3xl font-bold mb-8 text-purple-600">🎰 Đang Quay...</h2>

        {/* Spinning Player */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Nạn nhân:</p>
          <div className="relative overflow-hidden h-24 flex items-center justify-center rounded-xl bg-linear-to-r from-purple-100 to-pink-100 border-2 border-purple-300">
            <div className="animate-pulse">
              {displayPlayer && <PlayerAvatar avatar={displayPlayer.avatar} name={displayPlayer.name} size="lg" className="mx-auto" />}
              <p className="text-2xl font-black mt-1 text-purple-700">{displayPlayer?.name}</p>
            </div>
            {/* Slot machine lines */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-linear-to-b from-purple-200 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-linear-to-t from-purple-200 to-transparent"></div>
          </div>
        </div>

        {/* Spinning Request */}
        <div>
          <p className="text-sm text-gray-500 mb-2">Thử thách:</p>
          <div className="relative overflow-hidden h-20 flex items-center justify-center rounded-xl bg-linear-to-r from-orange-100 to-yellow-100 border-2 border-orange-300 px-4">
            <p className="text-lg font-bold text-orange-700 animate-pulse truncate">
              {displayRequest ? `"${displayRequest.text}"` : '...'}
            </p>
            <div className="absolute top-0 left-0 right-0 h-4 bg-linear-to-b from-orange-200 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-linear-to-t from-orange-200 to-transparent"></div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }}></div>
          ))}
        </div>
      </Card>
    );
  }

  if (phase === 'challenge' && selectedPlayer && selectedRequest) {
    const author = players.find(p => p.id === selectedRequest.playerId)?.name || 'Ẩn danh';
    const isPerformer = selectedPlayer.id === myId;
    const eligibleVoters = players.filter(p => p.id !== selectedPlayer.id).length;

    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-2">🎯 Người thực hiện:</h2>
        <div className="flex items-center justify-center gap-3 mb-6">
          <PlayerAvatar avatar={selectedPlayer.avatar} name={selectedPlayer.name} size="lg" />
          <p className="text-4xl font-black">{selectedPlayer.name}</p>
        </div>
        <div className="bg-orange-50 border p-6 rounded-xl mb-6">
          <p className="text-gray-500 text-sm mb-2">Yêu cầu từ: {author}</p>
          <p className="text-2xl font-semibold">&quot;{selectedRequest.text}&quot;</p>
        </div>

        {isPerformer ? (
          <p className="text-gray-500 text-lg animate-pulse">Hãy thực hiện thử thách! Đợi mọi người biểu quyết...</p>
        ) : myVote === null ? (
          <div className="space-y-3">
            <p className="font-semibold text-lg">Biểu quyết: {selectedPlayer.name} có thành công không?</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => castVote(true)} className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3">
                ✅ Thành Công
              </Button>
              <Button onClick={() => castVote(false)} variant="destructive" className="text-lg px-8 py-3">
                ❌ Thất Bại
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Đã biểu quyết! Chờ {Object.keys(votes).length}/{eligibleVoters} người...</p>
        )}
      </Card>
    );
  }

  // Vote result
  if (voteResult && selectedPlayer) {
    return (
      <Card className="p-8 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4">Kết Quả Biểu Quyết</h2>
        <div className={`p-6 rounded-xl mb-6 border-2 ${voteResult.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <p className="text-4xl mb-2">{voteResult.success ? '🎉' : '😈'}</p>
          <p className="text-2xl font-bold">{selectedPlayer.name} {voteResult.success ? 'Thành Công! (+3đ)' : 'Thất Bại! (-1đ & Phạt uống)'}</p>
          <p className="mt-2 text-gray-600">✅ {voteResult.yesCount} phiếu | ❌ {voteResult.noCount} phiếu</p>
        </div>
        {isHost && (
          <Button size="lg" className="w-full" onClick={nextRound}>
            🎲 Quay Tiếp / Tiếp Tục
          </Button>
        )}
      </Card>
    );
  }

  return null;
}

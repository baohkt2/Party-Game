'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/ui/player-avatar';
import { pusherClient, getRoomChannel } from '@/lib/pusher';
import { GameProps } from '@/lib/gameRegistry';

type CardType = { suit: '♠' | '♣' | '♦' | '♥', rank: string, value: number };
type PokerPhase = 'waiting' | 'phase1' | 'phase2' | 'phase3' | 'result';

interface PokerState {
  phase: PokerPhase;
  hands: Record<string, CardType[]>;
  activePlayers: string[];
  bets: Record<string, number>;
  pot: number;
  actedThisRound: string[];
  currentBet: number;
}

const generateDeck = (): CardType[] => {
  const suits: ('♠' | '♣' | '♦' | '♥')[] = ['♠', '♣', '♦', '♥'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: CardType[] = [];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      let value = parseInt(rank);
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      if (rank === 'A') value = 1;
      deck.push({ suit, rank, value });
    });
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const calculateHand = (cards: CardType[]) => {
  if (cards.length !== 3) return -1;
  if (cards.every(c => ['J', 'Q', 'K'].includes(c.rank))) return 99;
  if (cards[0].rank === cards[1].rank && cards[1].rank === cards[2].rank) return 999;
  const sum = cards.reduce((acc, curr) => acc + curr.value, 0);
  return sum % 10 === 0 ? 10 : sum % 10;
};

const INITIAL_STATE: PokerState = {
  phase: 'waiting', hands: {}, activePlayers: [], bets: {}, pot: 0, actedThisRound: [], currentBet: 1,
};

export default function Game5Poker({ roomId, players, isHost }: GameProps) {
  const [state, setState] = useState<PokerState>(INITIAL_STATE);
  const [hostDeck, setHostDeck] = useState<CardType[]>([]);
  const scoredRef = useRef(false);
  const myId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  useEffect(() => {
    const channel = pusherClient.subscribe(getRoomChannel(roomId));
    channel.bind('poker-sync', (data: PokerState) => setState(data));
    return () => { channel.unbind('poker-sync'); };
  }, [roomId]);

  useEffect(() => {
    if (!isHost || state.phase !== 'result' || scoredRef.current) return;
    scoredRef.current = true;
    const ranked = state.activePlayers
      .map(pId => ({ id: pId, score: calculateHand(state.hands[pId]) }))
      .sort((a, b) => b.score - a.score);
    const winnerCount = Math.ceil(players.length / 2);
    const updates: Promise<void>[] = [];
    ranked.forEach((r, i) => {
      const p = players.find(p => p.id === r.id);
      if (!p) return;
      const delta = i < winnerCount ? 5 : -2;
      updates.push(fetch(`/api/rooms/${roomId}/game/score`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: r.id, gameNumber: 5, score: (p.gameScores?.game5 || 0) + delta }),
      }).then(() => {}));
    });
    players.filter(p => !state.activePlayers.includes(p.id)).forEach(p => {
      updates.push(fetch(`/api/rooms/${roomId}/game/score`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: p.id, gameNumber: 5, score: (p.gameScores?.game5 || 0) - 2 }),
      }).then(() => {}));
    });
    Promise.all(updates);
  }, [state.phase, isHost, state.activePlayers, state.hands, players, roomId]);

  const broadcastState = useCallback((newState: PokerState) => {
    setState(newState);
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'poker-sync', data: newState }),
    });
  }, [roomId]);

  const dealNext = () => {
    let deck = [...hostDeck];
    let newState: PokerState;
    if (state.phase === 'waiting') {
      deck = generateDeck();
      const hands: Record<string, CardType[]> = {};
      const active = players.map(p => p.id);
      active.forEach(pId => { hands[pId] = [deck.pop()!]; });
      setHostDeck(deck); scoredRef.current = false;
      newState = { phase: 'phase1', hands, activePlayers: active, bets: {}, pot: 0, actedThisRound: [], currentBet: 1 };
    } else {
      const nextPhase: PokerPhase = state.phase === 'phase1' ? 'phase2' : state.phase === 'phase2' ? 'phase3' : 'result';
      const hands = { ...state.hands };
      if (nextPhase !== 'result') {
        state.activePlayers.forEach(pId => { hands[pId] = [...(hands[pId] || []), deck.pop()!]; });
      }
      setHostDeck(deck);
      newState = { ...state, phase: nextPhase, hands, actedThisRound: [], currentBet: 1 };
    }
    broadcastState(newState);
  };

  const handleAction = (action: 'call' | 'raise' | 'double' | 'fold') => {
    if (!myId) return;
    const newState = { ...state };
    let betAmount = 0;
    switch (action) {
      case 'call': betAmount = state.currentBet; break;
      case 'raise': betAmount = state.currentBet + 1; newState.currentBet = betAmount; break;
      case 'double': betAmount = state.currentBet * 2; newState.currentBet = betAmount; break;
      case 'fold': newState.activePlayers = state.activePlayers.filter(id => id !== myId); betAmount = 1; break;
    }
    newState.pot = state.pot + betAmount;
    newState.bets = { ...state.bets, [myId]: (state.bets[myId] || 0) + betAmount };
    newState.actedThisRound = [...state.actedThisRound, myId];
    setState(newState);
    fetch(`/api/rooms/${roomId}/game/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'poker-sync', data: newState }),
    });
  };

  // ─── CARD COMPONENT ───
  const PokerCard = ({ card, hidden = false, size = 'md' }: { card?: CardType, hidden?: boolean, size?: 'sm' | 'md' | 'lg' }) => {
    const sizes = {
      sm: 'w-10 h-14 text-xs',
      md: 'w-14 h-20 text-sm',
      lg: 'w-16 h-24 text-base',
    };
    if (hidden || !card) {
      return (
        <div className={`${sizes[size]} rounded-lg flex items-center justify-center shadow-xl border-2 border-blue-400`}
          style={{ background: 'repeating-linear-gradient(45deg, #1e3a5f, #1e3a5f 4px, #234875 4px, #234875 8px)' }}>
          <span className="text-white text-lg">🂠</span>
        </div>
      );
    }
    const isRed = ['♥', '♦'].includes(card.suit);
    return (
      <div className={`${sizes[size]} bg-white rounded-lg border border-gray-200 flex flex-col justify-between p-1 shadow-xl hover:shadow-2xl transition-shadow hover:-translate-y-1 duration-200`}>
        <span className={`font-black leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.rank}</span>
        <span className={`self-center ${isRed ? 'text-red-600' : 'text-gray-900'}`} style={{ fontSize: size === 'lg' ? '1.8rem' : size === 'md' ? '1.4rem' : '1rem' }}>{card.suit}</span>
        <span className={`font-black leading-none self-end rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.rank}</span>
      </div>
    );
  };

  // ─── CHIP COMPONENT ───
  const BetChip = ({ amount, highlight = false }: { amount: number, highlight?: boolean }) => (
    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-sm shadow-lg border-2 ${
      highlight
        ? 'bg-linear-to-r from-yellow-400 to-amber-500 text-amber-900 border-yellow-300 animate-pulse'
        : amount > 0
          ? 'bg-linear-to-r from-red-500 to-rose-600 text-white border-red-400'
          : 'bg-gray-400 text-white border-gray-300'
    }`}>
      <span>🍺</span> <span>{amount}</span>
    </div>
  );

  // ─── WAITING SCREEN ───
  if (state.phase === 'waiting') {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <div className="rounded-2xl p-8 text-center text-white shadow-2xl" style={{ background: 'radial-gradient(ellipse at center, #1a5c2e 0%, #0d3318 70%, #071a0d 100%)' }}>
          <div className="text-6xl mb-4">🃏</div>
          <h2 className="text-3xl font-black mb-2 tracking-wide" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            CÀO TỐ TAM KHÚC
          </h2>
          <p className="text-green-200 mb-6">Vòng đấu trí cuối cùng</p>

          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 mb-6 text-left text-sm text-green-100 space-y-2">
            <p>🃏 Mỗi vòng nhận <b>1 lá bài</b> (tổng 3 lá)</p>
            <p>🍺 Khởi điểm cược: <b>1 ngụm</b></p>
            <p>📌 Hành động: <b>Theo</b> · <b>Tăng (+1)</b> · <b>Gấp đôi (x2)</b> · <b>Bỏ bài</b></p>
            <p>🏆 Số người thắng = <b>Tổng người chơi / 2</b></p>
          </div>

          {isHost ? (
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-black text-lg px-8 shadow-lg" onClick={dealNext}>
              🃏 CHIA BÀI
            </Button>
          ) : (
            <p className="animate-pulse text-green-300 text-lg">Đợi host chia bài...</p>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULT SCREEN ───
  if (state.phase === 'result') {
    const ranked = state.activePlayers
      .map(pId => ({ id: pId, score: calculateHand(state.hands[pId]) }))
      .sort((a, b) => b.score - a.score);
    const winnerCount = Math.ceil(players.length / 2);
    const winnerIds = ranked.slice(0, winnerCount).map(r => r.id);
    const loserIds = ranked.slice(winnerCount).map(r => r.id);
    const foldedIds = players.filter(p => !state.activePlayers.includes(p.id)).map(p => p.id);
    const totalWinnerBets = winnerIds.reduce((s, wid) => s + (state.bets[wid] || 0), 0);
    const totalLosers = loserIds.length + foldedIds.length;

    return (
      <div className="max-w-3xl mx-auto w-full">
        <div className="rounded-2xl p-6 shadow-2xl text-white" style={{ background: 'radial-gradient(ellipse at center, #1a5c2e 0%, #0d3318 70%, #071a0d 100%)' }}>
          <h2 className="text-3xl font-black text-center mb-6" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            🏆 KẾT QUẢ
          </h2>

          {/* Pot display */}
          <div className="flex justify-center mb-6">
            <div className="bg-amber-500/20 border-2 border-amber-400 rounded-full px-8 py-3 flex items-center gap-3">
              <span className="text-3xl">🍺</span>
              <span className="text-3xl font-black text-amber-300">{state.pot}</span>
              <span className="text-amber-200">tổng pot</span>
            </div>
          </div>

          {/* Winners */}
          <div className="mb-4">
            <p className="text-center text-green-300 font-bold text-lg mb-3">🎉 WINNERS (+5đ)</p>
            <div className="space-y-2">
              {winnerIds.map((id, i) => {
                const p = players.find(p => p.id === id);
                const hand = state.hands[id];
                const score = calculateHand(hand);
                return (
                  <div key={id} className="flex items-center justify-between bg-green-900/50 border border-green-500/30 p-3 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-amber-400">#{i + 1}</span>
                      {p && <PlayerAvatar avatar={p.avatar} name={p.name} size="sm" />}
                      <span className="font-bold text-lg">{p?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">{hand?.map((c, j) => <PokerCard key={j} card={c} size="sm" />)}</div>
                      <div className="bg-amber-500 text-black px-3 py-1 rounded-lg font-black text-sm">
                        {score === 999 ? 'SÁP!' : score === 99 ? 'BA TÂY!' : `${score} nút`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Losers */}
          {loserIds.length > 0 && (
            <div className="mb-4">
              <p className="text-center text-red-300 font-bold text-lg mb-3">😢 LOSERS (-2đ)</p>
              <div className="space-y-2">
                {loserIds.map(id => {
                  const p = players.find(p => p.id === id);
                  const penalty = (state.bets[id] || 0) + (totalLosers > 0 ? totalWinnerBets / totalLosers : 0);
                  return (
                    <div key={id} className="flex items-center justify-between bg-red-900/30 border border-red-500/30 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        {p && <PlayerAvatar avatar={p.avatar} name={p.name} size="sm" />}
                        <span className="font-bold">{p?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">{state.hands[id]?.map((c, j) => <PokerCard key={j} card={c} size="sm" />)}</div>
                        <div className="bg-red-600 text-white px-3 py-1 rounded-lg font-black text-sm">
                          🍺 {penalty.toFixed(1)} ngụm
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Folded */}
          {foldedIds.length > 0 && (
            <div>
              <p className="text-center text-gray-400 font-bold mb-3">🏳️ BỎ BÀI (-2đ)</p>
              <div className="space-y-2">
                {foldedIds.map(id => {
                  const p = players.find(p => p.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between bg-gray-800/50 border border-gray-600/30 p-3 rounded-xl opacity-70">
                      <div className="flex items-center gap-3">
                        {p && <PlayerAvatar avatar={p.avatar} name={p.name} size="sm" />}
                        <span className="font-bold text-gray-300">{p?.name}</span>
                      </div>
                      <span className="text-gray-400 font-bold">🍺 {state.bets[id] || 0} ngụm</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── BETTING ROUNDS (Phase 1, 2, 3) ───
  const hasActed = state.actedThisRound.includes(myId!);
  const isActive = state.activePlayers.includes(myId!);
  const allActed = state.activePlayers.every(id => state.actedThisRound.includes(id));
  const phaseNumber = state.phase === 'phase1' ? 1 : state.phase === 'phase2' ? 2 : 3;

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, #1a5c2e 0%, #0d3318 70%, #071a0d 100%)' }}>

        {/* Top bar */}
        <div className="flex justify-between items-center px-6 py-3 bg-black/40">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">Lá {phaseNumber}/3</span>
            <div className="h-5 w-px bg-gray-600"></div>
            <span className="text-amber-300 text-sm">Cược: <b>{state.currentBet} ngụm</b></span>
          </div>
          {/* POT */}
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/50 rounded-full px-4 py-1.5">
            <span className="text-xl">🍺</span>
            <span className="text-2xl font-black text-amber-300">{state.pot}</span>
            <span className="text-amber-200 text-xs">POT</span>
          </div>
        </div>

        {/* TABLE - Player seats arranged around */}
        <div className="relative px-4 py-6">
          {/* Center pot area */}
          <div className="flex justify-center mb-4">
            <div className="w-32 h-16 rounded-full bg-green-800/60 border-2 border-green-600/40 flex items-center justify-center shadow-inner">
              <span className="text-green-200 text-sm font-bold">🃏 TABLE</span>
            </div>
          </div>

          {/* Player grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {players.map(p => {
              const pActive = state.activePlayers.includes(p.id);
              const pCards = state.hands[p.id] || [];
              const pActed = state.actedThisRound.includes(p.id);
              const pBet = state.bets[p.id] || 0;
              const isMe = p.id === myId;

              return (
                <div
                  key={p.id}
                  className={`relative rounded-xl p-3 transition-all duration-300 ${
                    !pActive
                      ? 'bg-gray-900/60 border border-gray-700 opacity-50'
                      : isMe
                        ? 'bg-green-900/50 border-2 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-green-900/40 border border-green-600/40'
                  }`}
                >
                  {/* Status badge */}
                  {!pActive && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">FOLD</span>
                  )}
                  {pActed && pActive && (
                    <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">✓</span>
                  )}

                  {/* Player info */}
                  <div className="flex items-center gap-2 mb-2">
                    <PlayerAvatar avatar={p.avatar} name={p.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                        {p.name} {isMe && '(Bạn)'}
                      </p>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex gap-1 justify-center mb-2">
                    {[0, 1, 2].map(idx => {
                      if (idx >= pCards.length) {
                        return <div key={idx} className="w-10 h-14 border border-dashed border-green-600/40 rounded-lg"></div>;
                      }
                      return <PokerCard key={idx} card={pCards[idx]} hidden={!isMe} size="sm" />;
                    })}
                  </div>

                  {/* Bet amount - PROMINENT */}
                  <div className="flex justify-center">
                    <BetChip amount={pBet} highlight={pBet > 0 && pActive} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="px-4 pb-4">
          {/* My cards large view */}
          {isActive && state.hands[myId!] && (
            <div className="flex justify-center gap-2 mb-4">
              {state.hands[myId!].map((c, i) => <PokerCard key={i} card={c} size="lg" />)}
            </div>
          )}

          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4">
            {isActive && !hasActed ? (
              <div className="text-center">
                <p className="text-green-200 mb-3 font-semibold">Hành động của bạn · Mức cược: <span className="text-amber-300 font-black">{state.currentBet} 🍺</span></p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg" onClick={() => handleAction('call')}>
                    ✅ Theo ({state.currentBet} 🍺)
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg" onClick={() => handleAction('raise')}>
                    ⬆️ Tăng ({state.currentBet + 1} 🍺)
                  </Button>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg" onClick={() => handleAction('double')}>
                    💥 x2 ({state.currentBet * 2} 🍺)
                  </Button>
                  <Button className="bg-red-700 hover:bg-red-800 text-white font-bold shadow-lg" onClick={() => handleAction('fold')}>
                    🏳️ Bỏ Bài
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center text-green-300/70 font-medium">
                {!isActive ? '🏳️ Bạn đã bỏ bài vòng này.' : '✓ Đã hành động. Chờ người khác...'}
              </p>
            )}

            {isHost && (
              <div className="mt-4 pt-3 border-t border-green-700/40 text-center">
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-black font-black shadow-lg disabled:opacity-40"
                  onClick={dealNext}
                  disabled={!allActed}
                >
                  {state.phase === 'phase3' ? '🃏 MỞ BÀI' : `🃏 CHIA LÁ TIẾP (${state.actedThisRound.length}/${state.activePlayers.length})`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

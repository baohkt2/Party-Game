type SessionKey = 'playerId' | 'playerName' | 'playerAvatar' | 'roomId';

interface SessionData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  roomId: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getSessionValue(key: SessionKey): string | null {
  if (!isBrowser()) return null;

  const sessionValue = window.sessionStorage.getItem(key);
  if (sessionValue) return sessionValue;

  // Backward compatibility for older sessions that used localStorage.
  const legacyValue = window.localStorage.getItem(key);
  if (legacyValue) {
    window.sessionStorage.setItem(key, legacyValue);
    return legacyValue;
  }

  return null;
}

export function setSessionData(data: SessionData): void {
  if (!isBrowser()) return;

  window.sessionStorage.setItem('playerId', data.playerId);
  window.sessionStorage.setItem('playerName', data.playerName);
  window.sessionStorage.setItem('playerAvatar', data.playerAvatar);
  window.sessionStorage.setItem('roomId', data.roomId);
}

export function getSessionPlayerId(): string | null {
  return getSessionValue('playerId');
}

-- Database Schema cho Party Game
-- Chạy script này trong Vercel Postgres hoặc Neon console

-- Bảng rooms: Lưu thông tin phòng chơi
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'waiting', -- waiting, configuring, playing, finished
  status_changed_at TIMESTAMP DEFAULT NOW(),
  current_game INTEGER DEFAULT 0,
  config JSONB DEFAULT '{"rounds":[]}'::jsonb
);

-- Bảng players: Lưu thông tin người chơi
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT,
  session_id TEXT UNIQUE NOT NULL,
  total_score INTEGER DEFAULT 0,
  scores JSONB DEFAULT '{}'::jsonb,
  game1_score INTEGER DEFAULT 0,
  game2_score INTEGER DEFAULT 0,
  game3_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW()
);

-- Bảng game_states: Lưu trạng thái game hiện tại
CREATE TABLE IF NOT EXISTS game_states (
  id SERIAL PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  game_number INTEGER,
  state JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes để tăng performance
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_game_states_room_id ON game_states(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_status_changed_at ON rooms(status_changed_at);

-- Seed data cho testing (optional)
-- INSERT INTO rooms (id, host_id, status, current_game) VALUES ('TEST01', 'host-1', 'waiting', 0);
-- INSERT INTO players (id, room_id, name, avatar, session_id) VALUES ('p1', 'TEST01', 'Test Player', '😀', 'session-1');

# 🎮 Vua Trò Chơi - Party Game Web App

Multiplayer party game với 3 mini-games, real-time leaderboard và mobile-responsive UI.

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Real-time**: Pusher
- **Database**: Vercel Postgres / Neon
- **State Management**: Zustand
- **Deployment**: Vercel

## 📦 Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Điền thông tin Pusher và Database vào .env.local

# Run development server
npm run dev
```

## 🗄️ Database Setup

1. Tạo Vercel Postgres hoặc Neon database
2. Copy connection strings vào `.env.local`
3. Chạy SQL schema từ file `database-schema.sql`

## 🎯 Build Progress

- [x] **Giai đoạn 0**: Khởi tạo dự án ✅
- [ ] **Giai đoạn 1**: Đăng nhập + Tạo/Join phòng
- [ ] **Giai đoạn 2**: Lobby Real-time
- [ ] **Giai đoạn 3-9**: Games & Deploy

## 📱 Development Commands

```bash
npm run dev   # Development server
npm run build # Build production
npm start     # Start production
npm run lint  # Lint code
```

## 📚 Project Structure

```
party-game/
├── src/
│   ├── app/          # Pages & API routes
│   ├── components/   # React components
│   ├── lib/          # Utilities (db, pusher, store, score)
│   └── types/        # TypeScript types
└── database-schema.sql
```

## 🐛 Troubleshooting

**Node version**: Cần >= 20.9.0

**Pusher không kết nối**: Kiểm tra credentials trong `.env.local`

**Database failed**: Verify connection strings

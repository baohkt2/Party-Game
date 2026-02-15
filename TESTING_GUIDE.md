# 🧪 HƯỚNG DẪN TEST GIAI ĐOẠN 1

## Chuẩn bị

### 1. Setup Database

Bạn cần tạo database trước khi test. Chọn 1 trong 2 options:

#### Option A: Vercel Postgres (Recommended)
```bash
# 1. Login Vercel CLI
npx vercel login

# 2. Link project
npx vercel link

# 3. Tạo Postgres database
npx vercel postgres create

# 4. Pull environment variables
npx vercel env pull .env.local

# 5. Chạy SQL schema
# Copy nội dung file database-schema.sql
# Paste vào Vercel Postgres Console
```

#### Option B: Neon (Alternative)
```bash
# 1. Tạo account tại https://neon.tech
# 2. Tạo project mới
# 3. Copy connection string
# 4. Thêm vào .env.local:

POSTGRES_URL="postgresql://..."
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# 5. Chạy SQL schema trong Neon SQL Editor
```

### 2. Setup Pusher

```bash
# 1. Tạo account tại https://pusher.com
# 2. Tạo Channels app
# 3. Copy credentials vào .env.local:

PUSHER_APP_ID="your-app-id"
PUSHER_SECRET="your-secret"
NEXT_PUBLIC_PUSHER_KEY="your-key"
NEXT_PUBLIC_PUSHER_CLUSTER="ap1"
```

### 3. Khởi động Server

```bash
npm run dev
```

---

## Test Cases - Giai đoạn 1

### ✅ T1.1: Nhập tên + tạo phòng

**Steps:**
1. Mở http://localhost:3000
2. Nhập tên: "Test Player 1" (2-15 ký tự)
3. Chọn "Tạo phòng"
4. Click "🎲 Tạo phòng mới"

**Expected:**
- ✅ Redirect đến `/lobby/XXXXXX` (6 ký tự)
- ✅ Toast hiển thị: "Phòng XXXXXX đã được tạo!"
- ✅ Lobby page load thành công
- ✅ Thấy player "Test Player 1" với icon 👑

**Verify Database:**
```sql
SELECT * FROM rooms;
SELECT * FROM players;
```

---

### ✅ T1.2: Tạo phòng → copy code → tab mới join

**Steps:**
1. Tab 1: Tạo phòng (như T1.1)
2. Copy room code (click vào mã phòng hoặc dùng nút copy)
3. Mở tab mới: http://localhost:3000
4. Nhập tên: "Test Player 2"
5. Chọn "Tham gia"
6. Paste room code
7. Click "🚪 Vào phòng"

**Expected:**
- ✅ Tab 2: Redirect đến `/lobby/XXXXXX`
- ✅ Tab 2: Thấy 2 players trong danh sách
- ✅ Tab 1: Tự động thấy player mới (nếu Pusher hoạt động)
  - Nếu không tự động: bấm nút "🔄 Làm mới"

---

### ✅ T1.3: Join phòng không tồn tại

**Steps:**
1. Mở http://localhost:3000
2. Nhập tên: "Test Player"
3. Chọn "Tham gia"
4. Nhập mã phòng: "ABC123" (phòng không tồn tại)
5. Click "🚪 Vào phòng"

**Expected:**
- ✅ Toast error: "Phòng không tồn tại hoặc đã bắt đầu"
- ✅ Không redirect
- ✅ Stay ở trang login

---

### ✅ T1.4: Join phòng với tên rỗng

**Steps:**
1. Mở http://localhost:3000
2. Nhập tên: "" (để trống)
3. Chọn "Tham gia"
4. Nhập mã phòng: "ABC123"

**Expected:**
- ✅ Button "🚪 Vào phòng" bị **disabled**
- ✅ Không thể click

**Hoặc:**
1. Nhập tên: "A" (1 ký tự)
2. Click button

**Expected:**
- ✅ Toast error: "Tên phải có ít nhất 2 ký tự"

---

### ✅ T1.5: API trả về đúng format

**Steps:**
1. Mở DevTools (F12)
2. Chọn tab "Network"
3. Tạo phòng hoặc join phòng
4. Tìm request `/api/rooms` hoặc `/api/rooms/join`
5. Check response body

**Expected Response (Tạo phòng):**
```json
{
  "success": true,
  "data": {
    "roomId": "XXXXXX",
    "playerId": "nanoid-string"
  }
}
```

**Expected Response (Join phòng):**
```json
{
  "success": true,
  "data": {
    "roomId": "XXXXXX",
    "playerId": "nanoid-string"
  }
}
```

---

### ✅ T1.6: localStorage lưu đúng

**Steps:**
1. Tạo phòng hoặc join phòng
2. Mở DevTools (F12)
3. Application tab → Storage → Local Storage → http://localhost:3000

**Expected:**
```
playerId: "nanoid-string"
playerName: "Test Player 1"
roomId: "XXXXXX"
```

---

## Debug Tips

### Database không kết nối
```bash
# Kiểm tra connection string
echo $POSTGRES_URL

# Test connection (nếu có psql)
psql $POSTGRES_URL -c "SELECT 1"
```

### Pusher không hoạt động
- Check credentials trong `.env.local`
- Check Pusher Dashboard > Channels > Debug Console
- Real-time update có thể chậm 1-2 giây

### API errors
- Check terminal logs
- Check browser console (F12)
- Check Network tab trong DevTools

---

## Quick Test Script

Nếu muốn test nhanh toàn bộ flow:

```bash
# Terminal 1: Start dev server
npm run dev

# Browser:
# 1. Tab 1: http://localhost:3000
#    → Click "⚡ Chơi nhanh (Dev)" → Copy room code
# 2. Tab 2: http://localhost:3000
#    → Click "⚡ Chơi nhanh (Dev)" → Mode "Tham gia" → Paste code
# 3. Tab 1: Click "Làm mới" → Thấy 2 players
```

---

## ✅ Checklist Hoàn Thành

- [ ] T1.1: Tạo phòng thành công
- [ ] T1.2: Join phòng từ tab khác
- [ ] T1.3: Error khi join phòng không tồn tại
- [ ] T1.4: Button disabled khi tên rỗng
- [ ] T1.5: API response đúng format
- [ ] T1.6: localStorage lưu đúng data

Nếu **tất cả** đều pass → **Giai đoạn 1 hoàn thành!** 🎉

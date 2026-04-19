# ClassQuest

Minecraft 風格的課堂管理系統。

## 技術棧
- 前端：React 18 + Vite + React Router + Socket.IO client
- 後端：Node.js + Express + pg + JWT + Socket.IO
- 資料庫：PostgreSQL 16
- 部署：Docker Compose

## 快速啟動

```bash
cp .env.example .env
# 編輯 .env 改密碼 / JWT_SECRET
docker compose up -d --build
```

開啟 http://localhost/

## 預設帳號
首次啟動會建立以下帳號（密碼皆為 `password123`，上線後請改）：
- admin / 管理員
- teacher1 / 老師範例
- student1 ~ student3 / 學生範例

## 目錄
- backend/  Express API
- frontend/ React + Nginx
- db/init/  Postgres 首次啟動的 schema

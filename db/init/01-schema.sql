-- ClassQuest Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)  UNIQUE NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    password_hash TEXT         NOT NULL,
    role          user_role    NOT NULL DEFAULT 'student',
    level         INTEGER      NOT NULL DEFAULT 1 CHECK (level >= 1),
    exp           INTEGER      NOT NULL DEFAULT 0 CHECK (exp >= 0),
    points        INTEGER      NOT NULL DEFAULT 0 CHECK (points >= 0),
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE quests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    reward_exp    INTEGER      NOT NULL DEFAULT 0,
    reward_points INTEGER      NOT NULL DEFAULT 0,
    difficulty    VARCHAR(20)  DEFAULT 'normal',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_quests_active ON quests(is_active);

CREATE TABLE submissions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_id       UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    student_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content        TEXT,
    attachment_url TEXT,
    status         submission_status NOT NULL DEFAULT 'pending',
    reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    review_note    TEXT,
    submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at    TIMESTAMPTZ
);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_student ON submissions(student_id);

CREATE TABLE shop_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    price       INTEGER      NOT NULL CHECK (price >= 0),
    stock       INTEGER      NOT NULL DEFAULT -1,
    icon_url    TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE shop_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id    UUID REFERENCES shop_items(id) ON DELETE SET NULL,
    item_name  VARCHAR(100) NOT NULL,
    price_paid INTEGER      NOT NULL,
    quantity   INTEGER      NOT NULL DEFAULT 1,
    note       TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_shop_logs_student ON shop_logs(student_id);
CREATE INDEX idx_shop_logs_created ON shop_logs(created_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 預設帳號（密碼皆為 password123，上線請改）
-- bcrypt hash of "password123" (cost 10)
INSERT INTO users (username, display_name, password_hash, role, level, points) VALUES
('admin',    '系統管理員', '$2b$10$ApB6ypbKfo/lFS2ZWmbIo.sfPx9oId84sO4Px9S2fKo0sEeV9yVdi', 'admin',   99, 0),
('teacher1', '王老師',    '$2b$10$ApB6ypbKfo/lFS2ZWmbIo.sfPx9oId84sO4Px9S2fKo0sEeV9yVdi', 'teacher', 50, 0),
('student1', '小明',      '$2b$10$ApB6ypbKfo/lFS2ZWmbIo.sfPx9oId84sO4Px9S2fKo0sEeV9yVdi', 'student', 1, 100),
('student2', '小華',      '$2b$10$ApB6ypbKfo/lFS2ZWmbIo.sfPx9oId84sO4Px9S2fKo0sEeV9yVdi', 'student', 1, 50),
('student3', '小美',      '$2b$10$ApB6ypbKfo/lFS2ZWmbIo.sfPx9oId84sO4Px9S2fKo0sEeV9yVdi', 'student', 2, 200);

-- 預設任務
INSERT INTO quests (title, description, reward_exp, reward_points, difficulty, created_by)
SELECT '完成 Scratch 小貓動畫', '製作一個小貓走路的動畫作品', 50, 20, 'easy', id FROM users WHERE username='teacher1';
INSERT INTO quests (title, description, reward_exp, reward_points, difficulty, created_by)
SELECT 'Python 猜數字遊戲', '寫一個 1-100 的猜數字遊戲', 100, 50, 'normal', id FROM users WHERE username='teacher1';
INSERT INTO quests (title, description, reward_exp, reward_points, difficulty, created_by)
SELECT 'Minecraft 紅石電路', '建造一個自動門紅石電路', 150, 80, 'hard', id FROM users WHERE username='teacher1';

-- 預設商品
INSERT INTO shop_items (name, description, price, stock) VALUES
('免寫作業券',       '可抵免一次作業',       100, -1),
('額外下課 5 分鐘',  '全班多 5 分鐘下課',    200, 10),
('選位置券',         '下週可選任意座位',     150, 20),
('老師神祕小禮物',   '老師準備的驚喜',       300, 5);

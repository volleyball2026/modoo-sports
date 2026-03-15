/*
  # 스포츠 매칭 플랫폼 스키마

  1. 새 테이블
    - `profiles`
      - `id` (uuid, auth.users의 FK)
      - `nickname` (text, 닉네임)
      - `phone` (text, 전화번호)
      - `created_at` (timestamp)
    
    - `matches`
      - `id` (uuid, PK)
      - `manager_id` (uuid, profiles FK)
      - `sport_type` (text, 종목: 배구/풋살/농구/배드민턴/테니스)
      - `title` (text, 매치 제목)
      - `description` (text, 매치 설명)
      - `location` (text, 장소)
      - `location_detail` (text, 상세 주소)
      - `latitude` (numeric, 위도)
      - `longitude` (numeric, 경도)
      - `match_date` (timestamp, 매치 일시)
      - `max_participants` (integer, 최대 참가 인원)
      - `current_participants` (integer, 현재 참가 인원, 기본값 1)
      - `fee` (integer, 참가비)
      - `status` (text, 상태: open/closed/cancelled)
      - `created_at` (timestamp)
    
    - `match_participants`
      - `id` (uuid, PK)
      - `match_id` (uuid, matches FK)
      - `user_id` (uuid, profiles FK)
      - `status` (text, 상태: pending/approved/rejected)
      - `created_at` (timestamp)

  2. 보안
    - 모든 테이블에 RLS 활성화
    - profiles: 본인 정보는 읽기/수정 가능, 다른 사용자는 읽기만 가능
    - matches: 누구나 읽기 가능, 본인이 만든 매치만 수정/삭제 가능
    - match_participants: 누구나 읽기 가능, 본인 참가 정보만 생성/수정 가능
*/

-- 프로필 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 프로필을 조회 가능"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "사용자는 자신의 프로필을 생성 가능"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "사용자는 자신의 프로필을 수정 가능"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 매치 테이블
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport_type text NOT NULL CHECK (sport_type IN ('배구', '풋살', '농구', '배드민턴', '테니스')),
  title text NOT NULL,
  description text,
  location text NOT NULL,
  location_detail text,
  latitude numeric,
  longitude numeric,
  match_date timestamptz NOT NULL,
  max_participants integer NOT NULL CHECK (max_participants > 0),
  current_participants integer DEFAULT 1 CHECK (current_participants >= 0),
  fee integer DEFAULT 0 CHECK (fee >= 0),
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 매치를 조회 가능"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "인증된 사용자는 매치를 생성 가능"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "매니저는 자신의 매치를 수정 가능"
  ON matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = manager_id)
  WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "매니저는 자신의 매치를 삭제 가능"
  ON matches FOR DELETE
  TO authenticated
  USING (auth.uid() = manager_id);

-- 매치 참가자 테이블
CREATE TABLE IF NOT EXISTS match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 참가자 정보를 조회 가능"
  ON match_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "사용자는 매치에 참가 신청 가능"
  ON match_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 참가 정보를 수정 가능"
  ON match_participants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 참가를 취소 가능"
  ON match_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_matches_sport_type ON matches(sport_type);
CREATE INDEX IF NOT EXISTS idx_matches_match_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user_id ON match_participants(user_id);
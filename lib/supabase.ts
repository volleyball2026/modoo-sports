import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SportType = '배구' | '풋살' | '농구' | '배드민턴' | '테니스';

export interface Profile {
  id: string;
  nickname: string;
  phone?: string;
  created_at: string;
}

export interface Match {
  id: string;
  manager_id: string;
  sport_type: SportType;
  title: string;
  description?: string;
  location: string;
  location_detail?: string;
  latitude?: number;
  longitude?: number;
  match_date: string;
  max_participants: number;
  current_participants: number;
  fee: number;
  status: 'open' | 'closed' | 'cancelled';
  created_at: string;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export const SPORT_TYPES: { value: SportType; label: string; emoji: string }[] = [
  { value: '배구', label: '배구', emoji: '🏐' },
  { value: '풋살', label: '풋살', emoji: '⚽' },
  { value: '농구', label: '농구', emoji: '🏀' },
  { value: '배드민턴', label: '배드민턴', emoji: '🏸' },
  { value: '테니스', label: '테니스', emoji: '🎾' },
];

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Match, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { User, Calendar, MapPin, LogOut, Trophy, Save, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export const revalidate = 0;

const SKILL_LEVELS = ["입문", "초급", "중급", "고급", "최상급"];
const VOLLEYBALL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백", "상관없음"];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [participatedMatches, setParticipatedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const [profileExt, setProfileExt] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ 
    primary_sport: '배구',
    skill_level: '입문', 
    preferred_position: [] as string[] 
  });

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // 신규 가입자 프로필 자동 생성/업데이트
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '사용자',
        avatar_url: user.user_metadata?.avatar_url || '',
      });

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        
      if (profileData) {
        setProfileExt(profileData);
        setEditForm({
          primary_sport: profileData.primary_sport || '배구',
          skill_level: profileData.skill_level || '입문',
          preferred_position: profileData.preferred_position ? profileData.preferred_position.split(',') : []
        });
      }

      setUser(user);
      await Promise.all([fetchMyMatches(user.id), fetchParticipatedMatches(user.id)]);
    } catch (error) {
      console.error('사용자 정보 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyMatches(userId: string) {
    const { data } = await supabase.from('matches').select('*').eq('manager_id', userId).order('match_date', { ascending: false });
    setMyMatches(data || []);
  }

  async function fetchParticipatedMatches(userId: string) {
    const { data: participants } = await supabase.from('match_participants').select('match_id').eq('user_id', userId);
    if (!participants || participants.length === 0) { setParticipatedMatches([]); return; }
    const matchIds = participants.map((p) => p.match_id);
    const { data } = await supabase.from('matches').select('*').in('id', matchIds).order('match_date', { ascending: false });
    setParticipatedMatches(data || []);
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const { error } = await supabase.from('profiles').update({
          primary_sport: editForm.primary_sport,
          skill_level: editForm.skill_level,
          preferred_position: editForm.preferred_position.join(',')
      }).eq('id', user.id);

      if (error) throw error;
      setProfileExt({ ...profileExt, ...editForm });
      setIsEditing(false);
      alert('운동 프로필이 저장되었습니다! 🏆');
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // [핵심] 포지션 다중 선택 토글 (최대 2개 제한)
  const togglePosition = (pos: string) => {
    const current = editForm.preferred_position;
    if (current.includes(pos)) {
      setEditForm({ ...editForm, preferred_position: current.filter(p => p !== pos) });
    } else {
      if (current.length >= 2) {
        alert('주 포지션은 최대 2개까지만 선택할 수 있습니다.');
        return;
      }
      setEditForm({ ...editForm, preferred_position: [...current, pos] });
    }
  };

  function getSportEmoji(sportType: string) {
    const sport = SPORT_TYPES.find((s) => s.value === sportType);
    return sport?.emoji || '';
  }

  if (loading) return <div className="p-10 text-center font-bold text-sport-blue">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b p-4 max-w-lg mx-auto"><h1 className="text-xl font-bold">내 프로필</h1></header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-16 h-16 rounded-full border" />
            ) : (
              <div className="w-16 h-16 bg-sport-blue rounded-full flex items-center justify-center"><User className="w-8 h-8 text-white" /></div>
            )}
            <div>
              <h2 className="text-xl font-bold">{user?.user_metadata?.full_name || '사용자'}</h2>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-bold">로그아웃</button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> 나의 운동 정보</h3>
            {!isEditing && <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-sport-blue">수정하기</button>}
          </div>

          {isEditing ? (
            <div className="space-y-5 pt-2">
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">주 종목</label>
                <select className="w-full mt-1 p-3 rounded-lg border font-bold" value={editForm.primary_sport} onChange={(e) => setEditForm({...editForm, primary_sport: e.target.value, preferred_position: []})}>
                  {SPORT_TYPES.map(sport => <option key={sport.value} value={sport.value}>{sport.emoji} {sport.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">내 실력</label>
                <select className="w-full mt-1 p-3 rounded-lg border font-bold" value={editForm.skill_level} onChange={(e) => setEditForm({...editForm, skill_level: e.target.value})}>
                  {SKILL_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">선호 포지션 (최대 2개)</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {VOLLEYBALL_POSITIONS.map(pos => {
                    const isSelected = editForm.preferred_position.includes(pos);
                    return (
                      <button key={pos} onClick={() => togglePosition(pos)} className={`py-2 text-sm font-bold rounded-lg border ${isSelected ? 'bg-sport-blue text-white' : 'bg-white text-gray-500'}`}>
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}{pos}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3 rounded-lg bg-gray-100 font-bold">취소</button>
                <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-3 rounded-lg bg-sport-blue text-white font-bold flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-bold mb-1">종목</p>
                <p className="font-bold">{getSportEmoji(profileExt?.primary_sport)} {profileExt?.primary_sport || '배구'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-xs text-gray-500 font-bold mb-1">실력</p>
                <p className="font-bold">{profileExt?.skill_level || '입문'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl overflow-hidden">
                <p className="text-xs text-gray-500 font-bold mb-1">포지션</p>
                <p className="font-bold text-sport-blue text-sm truncate">{profileExt?.preferred_position?.split(',').join(', ') || '미설정'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="font-bold text-lg">참가한 매치</h3>
          {participatedMatches.map(match => (
            <Link key={match.id} href={`/match/${match.id}`} className="block bg-white p-4 rounded-lg border mb-3 shadow-sm">
              <p className="font-bold">{getSportEmoji(match.sport_type)} {match.title}</p>
              <div className="flex gap-4 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{format(new Date(match.match_date), 'M/d HH:mm', { locale: ko })}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{match.location}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
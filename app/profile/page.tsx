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
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [participatedMatches, setParticipatedMatches] = useState<any[]>([]);
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
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyMatches(userId: string) {
    const { data } = await supabase.from('matches').select('*').eq('manager_id', userId).order('match_date', { ascending: false }) as any;
    setMyMatches(data || []);
  }

  async function fetchParticipatedMatches(userId: string) {
    const { data: participants } = await supabase.from('match_participants').select('match_id').eq('user_id', userId) as any;
    if (!participants || participants.length === 0) { setParticipatedMatches([]); return; }
    const matchIds = participants.map((p: any) => p.match_id);
    const { data } = await supabase.from('matches').select('*').in('id', matchIds).order('match_date', { ascending: false }) as any;
    setParticipatedMatches(data || []);
  }

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await supabase.from('profiles').update({
          primary_sport: editForm.primary_sport,
          skill_level: editForm.skill_level,
          preferred_position: editForm.preferred_position.join(',')
      }).eq('id', user.id);
      setProfileExt({ ...profileExt, ...editForm });
      setIsEditing(false);
      alert('프로필 저장 완료! 🏆');
    } catch (error) {
      alert('저장 실패');
    } finally { setSaving(false); }
  };

  const togglePosition = (pos: string) => {
    const current = editForm.preferred_position;
    if (current.includes(pos)) {
      setEditForm({ ...editForm, preferred_position: current.filter(p => p !== pos) });
    } else {
      if (current.length >= 2) { alert('최대 2개까지만 선택 가능합니다.'); return; }
      setEditForm({ ...editForm, preferred_position: [...current, pos] });
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-sport-blue">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b p-4 max-w-lg mx-auto font-bold text-xl">내 프로필</header>
      <main className="max-w-lg mx-auto p-4">
        <div className="bg-white rounded-3xl p-6 border mb-6 flex items-center gap-4 shadow-sm">
           <div className="w-16 h-16 bg-sport-blue rounded-full flex items-center justify-center text-white"><User /></div>
           <div><p className="font-bold text-lg">{user?.user_metadata?.full_name || '사용자'}</p><p className="text-sm text-gray-500">{user?.email}</p></div>
        </div>

        <div className="bg-white rounded-3xl p-6 border mb-6 shadow-sm">
           <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><Trophy className="text-yellow-500"/> 운동 정보</h3>
           {!isEditing && <button onClick={() => setIsEditing(true)} className="text-sport-blue text-sm font-bold">수정</button>}</div>
           
           {isEditing ? (
             <div className="space-y-4">
               <select className="w-full p-4 rounded-xl border font-bold" value={editForm.primary_sport} onChange={(e) => setEditForm({...editForm, primary_sport: e.target.value, preferred_position: []})}>
                 {SPORT_TYPES.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
               </select>
               <div className="grid grid-cols-3 gap-2">
                 {VOLLEYBALL_POSITIONS.map(pos => (
                   <button key={pos} onClick={() => togglePosition(pos)} className={`py-2 text-xs font-bold rounded-lg border ${editForm.preferred_position.includes(pos) ? 'bg-sport-blue text-white' : 'bg-white text-gray-400'}`}>{pos}</button>
                 ))}
               </div>
               <button onClick={handleSaveProfile} className="w-full py-4 bg-sport-blue text-white rounded-xl font-bold">저장하기</button>
             </div>
           ) : (
             <div className="flex gap-4">
               <div className="flex-1 bg-gray-50 p-3 rounded-xl text-center"><p className="text-xs text-gray-400">실력</p><p className="font-bold">{profileExt?.skill_level || '입문'}</p></div>
               <div className="flex-1 bg-gray-50 p-3 rounded-xl text-center"><p className="text-xs text-gray-400">포지션</p><p className="font-bold text-sport-blue">{profileExt?.preferred_position || '미설정'}</p></div>
             </div>
           )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Match, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { User, Calendar, MapPin, LogOut, Trophy, Save, Loader2, Check, Info } from 'lucide-react';
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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { router.push('/login'); return; }

      await supabase.from('profiles').upsert({
        id: currentUser.id,
        full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '사용자',
        avatar_url: currentUser.user_metadata?.avatar_url || '',
      });

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (profileData) {
        setProfileExt(profileData);
        setEditForm({
          primary_sport: profileData.primary_sport || '배구',
          skill_level: profileData.skill_level || '입문',
          preferred_position: profileData.preferred_position ? profileData.preferred_position.split(',') : []
        });
      }
      setUser(currentUser);
      await Promise.all([fetchMyMatches(currentUser.id), fetchParticipatedMatches(currentUser.id)]);
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
      alert('프로필 정보가 업데이트되었습니다! 🏆');
    } catch (error) {
      alert('저장 실패');
    } finally { setSaving(false); }
  };

  const togglePosition = (pos: string) => {
    const current = editForm.preferred_position;
    if (current.includes(pos)) {
      setEditForm({ ...editForm, preferred_position: current.filter(p => p !== pos) });
    } else {
      if (current.length >= 2) {
        alert('최대 2개까지만 선택 가능합니다.\n(3순위는 매치 신청 시 고를 수 있어요!)');
        return;
      }
      setEditForm({ ...editForm, preferred_position: [...current, pos] });
    }
  };

  function getSportEmoji(sportType: string) {
    const sport = SPORT_TYPES.find((s) => s.value === sportType);
    return sport?.emoji || '';
  }

  if (loading) return <div className="p-10 text-center font-bold text-sport-blue">데이터 불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-6 py-4">
          <h1 className="text-xl font-black text-gray-900">내 프로필</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* 유저 카드 */}
        <div className="bg-white rounded-[32px] p-6 border shadow-sm flex items-center gap-5">
           <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100 shadow-inner">
             {user?.user_metadata?.avatar_url ? (
               <img src={user.user_metadata.avatar_url} className="w-full h-full rounded-full object-cover" />
             ) : <User className="text-sport-blue w-8 h-8" />}
           </div>
           <div>
             <p className="font-black text-xl">{user?.user_metadata?.full_name || '사용자'}</p>
             <p className="text-sm text-gray-400 font-medium">{user?.email}</p>
           </div>
           <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="ml-auto p-2 text-gray-300 hover:text-red-400 transition-colors">
             <LogOut className="w-5 h-5" />
           </button>
        </div>

        {/* 운동 정보 카드 */}
        <div className="bg-white rounded-[32px] p-6 border shadow-sm">
           <div className="flex justify-between items-center mb-6">
             <h3 className="font-black text-lg flex items-center gap-2"><Trophy className="text-yellow-400 w-5 h-5 fill-yellow-400"/> 나의 운동 정보</h3>
             {!isEditing && (
               <button onClick={() => setIsEditing(true)} className="text-sport-blue bg-blue-50 px-4 py-1.5 rounded-full text-xs font-black hover:bg-blue-100 transition-colors">
                 수정하기
               </button>
             )}
           </div>
           
           {isEditing ? (
             <div className="space-y-6">
               <div className="space-y-2">
                 <label className="text-xs font-black text-gray-400 ml-1 uppercase">주 종목</label>
                 <select className="w-full p-4 rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold transition-all" value={editForm.primary_sport} onChange={(e) => setEditForm({...editForm, primary_sport: e.target.value, preferred_position: []})}>
                   {SPORT_TYPES.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
                 </select>
               </div>

               <div className="space-y-2">
                 <label className="text-xs font-black text-gray-400 ml-1 uppercase">내 실력</label>
                 <select className="w-full p-4 rounded-2xl border-2 border-gray-50 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold transition-all" value={editForm.skill_level} onChange={(e) => setEditForm({...editForm, skill_level: e.target.value})}>
                   {SKILL_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                 </select>
               </div>

               <div className="space-y-3">
                 <div className="flex flex-col ml-1">
                   <label className="text-sm font-black text-gray-700">선호 포지션 <span className="text-sport-blue">(최대 2개)</span></label>
                   <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1 mt-0.5">
                     <Info className="w-3 h-3" /> 주 포지션 2개를 선택해주세요. (3순위는 매치 시 선택)
                   </p>
                 </div>
                 <div className="grid grid-cols-3 gap-2">
                   {VOLLEYBALL_POSITIONS.map(pos => {
                     const isSelected = editForm.preferred_position.includes(pos);
                     return (
                       <button key={pos} onClick={() => togglePosition(pos)} className={`py-3 text-xs font-black rounded-xl border-2 transition-all ${isSelected ? 'bg-sport-blue text-white border-sport-blue shadow-lg shadow-blue-100' : 'bg-white text-gray-400 border-gray-50 hover:border-gray-200'}`}>
                         {pos}
                       </button>
                     );
                   })}
                 </div>
               </div>

               <div className="flex gap-2 pt-4">
                 <button onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-black">취소</button>
                 <button onClick={handleSaveProfile} disabled={saving} className="flex-2 py-4 bg-gray-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-gray-200">
                   {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 저장하기
                 </button>
               </div>
             </div>
           ) : (
             <div className="grid grid-cols-2 gap-4">
               <div className="bg-gray-50 p-4 rounded-2xl text-center border border-gray-100">
                 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">내 실력 레벨</p>
                 <p className="font-black text-gray-900">{profileExt?.skill_level || '입문'}</p>
               </div>
               <div className="bg-blue-50 p-4 rounded-2xl text-center border border-blue-100">
                 <p className="text-[10px] text-sport-blue font-bold uppercase mb-1">선호 포지션</p>
                 <p className="font-black text-sport-blue truncate px-1">{profileExt?.preferred_position || '미설정'}</p>
               </div>
             </div>
           )}
        </div>

        {/* 참여 매치 리스트 */}
        <div className="space-y-4">
          <h3 className="font-black text-lg px-2 flex items-center gap-2">나의 참여 기록 <span className="text-sm text-gray-300">({participatedMatches.length})</span></h3>
          {participatedMatches.length > 0 ? participatedMatches.map(match => (
            <Link key={match.id} href={`/match/${match.id}`} className="block bg-white p-5 rounded-[28px] border shadow-sm hover:border-sport-blue transition-all active:scale-[0.98]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{getSportEmoji(match.sport_type)}</span>
                <span className="text-xs font-black text-sport-blue bg-blue-50 px-2 py-1 rounded-md">{match.sport_type}</span>
              </div>
              <p className="font-black text-gray-900 text-lg mb-3 line-clamp-1">{match.title}</p>
              <div className="flex gap-4 text-xs text-gray-400 font-bold">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/>{format(new Date(match.match_date), 'M/d HH:mm', { locale: ko })}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/>{match.location}</span>
              </div>
            </Link>
          )) : (
            <div className="text-center py-10 bg-white rounded-[32px] border border-dashed text-gray-300 font-bold">참여한 매치가 아직 없습니다.</div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
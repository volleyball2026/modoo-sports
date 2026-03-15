'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Match, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { User, Calendar, MapPin, LogOut, Trophy, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// [추가] 항상 최신 데이터를 불러오도록 캐시 무효화
export const revalidate = 0;

// [추가] 배구 포지션 및 실력 레벨 상수
const SKILL_LEVELS = ["입문", "초급", "중급", "고급", "최상급"];
const VOLLEYBALL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백", "상관없음"];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [participatedMatches, setParticipatedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // [추가] 배구 프로필 상태 관리
  const [profileExt, setProfileExt] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ skill_level: '입문', preferred_position: '상관없음' });

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // [유지] 로그인한 사용자의 정보를 profiles 테이블에 자동 저장/업데이트
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '사용자',
          avatar_url: user.user_metadata?.avatar_url || '',
        });

      if (profileError) {
        console.error('프로필 정보 동기화 실패:', profileError);
      }

      // [추가] 배구 실력, 포지션, 마일리지 정보 불러오기
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileData) {
        setProfileExt(profileData);
        setEditForm({
          skill_level: profileData.skill_level || '입문',
          preferred_position: profileData.preferred_position || '상관없음'
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

  // [유지] 내 매치 불러오기
  async function fetchMyMatches(userId: string) {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('manager_id', userId)
        .order('match_date', { ascending: false });

      if (error) throw error;
      setMyMatches(data || []);
    } catch (error) {
      console.error('내 매치 불러오기 실패:', error);
    }
  }

  // [유지] 참가 매치 불러오기
  async function fetchParticipatedMatches(userId: string) {
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', userId);

      if (participantsError) throw participantsError;

      if (!participants || participants.length === 0) {
        setParticipatedMatches([]);
        return;
      }

      const matchIds = participants.map((p) => p.match_id);

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .in('id', matchIds)
        .order('match_date', { ascending: false });

      if (error) throw error;
      setParticipatedMatches(data || []);
    } catch (error) {
      console.error('참가 매치 불러오기 실패:', error);
    }
  }

  // [추가] 배구 프로필 저장 함수
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          skill_level: editForm.skill_level,
          preferred_position: editForm.preferred_position
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setProfileExt({ ...profileExt, ...editForm });
      setIsEditing(false);
      alert('배구 프로필이 저장되었습니다! 🏐');
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // [유지] 로그아웃 함수
  async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  }

  // [유지] 이모지 변환 함수
  function getSportEmoji(sportType: string) {
    const sport = SPORT_TYPES.find((s) => s.value === sportType);
    return sport?.emoji || '';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sport-blue"></div>
      </div>
    );
  }

  const nickname = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">내 프로필</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        
        {/* --- [유지] 기존 프로필 기본 정보 카드 --- */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="프로필 이미지" 
                className="w-16 h-16 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 bg-sport-blue rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            
            <div>
              <h2 className="text-xl font-bold text-gray-900">{nickname}</h2>
              <p className="text-sm text-gray-600 mt-1">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-sport-blue">{myMatches.length}</p>
              <p className="text-sm text-gray-600 mt-1">개설한 매치</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sport-green">{participatedMatches.length}</p>
              <p className="text-sm text-gray-600 mt-1">참가한 매치</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold"
          >
            <LogOut className="w-5 h-5" /> 로그아웃
          </button>
        </div>

        {/* --- [추가] 나의 배구 정보 설정 카드 --- */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> 나의 배구 정보
            </h3>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-sport-blue bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                수정하기
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">내 실력 (레벨)</label>
                <select 
                  className="w-full mt-1 p-3 rounded-lg border border-gray-200 font-bold bg-white focus:border-sport-blue outline-none"
                  value={editForm.skill_level}
                  onChange={(e) => setEditForm({...editForm, skill_level: e.target.value})}
                >
                  {SKILL_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 ml-1">주 포지션</label>
                <select 
                  className="w-full mt-1 p-3 rounded-lg border border-gray-200 font-bold bg-white focus:border-sport-blue outline-none"
                  value={editForm.preferred_position}
                  onChange={(e) => setEditForm({...editForm, preferred_position: e.target.value})}
                >
                  {VOLLEYBALL_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setIsEditing(false)} className="flex-1 py-3 rounded-lg font-bold bg-gray-100 text-gray-600 hover:bg-gray-200">취소</button>
                <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-3 rounded-lg font-bold bg-sport-blue text-white flex items-center justify-center gap-2 hover:bg-blue-700">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center pt-2">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 font-bold mb-1">실력</p>
                <p className="font-bold text-gray-900">{profileExt?.skill_level || '입문'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 font-bold mb-1">포지션</p>
                <p className="font-bold text-sport-blue">{profileExt?.preferred_position || '상관없음'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 font-bold mb-1">마일리지</p>
                <p className="font-bold text-sport-green">{profileExt?.mileage || 0}점</p>
              </div>
            </div>
          )}
        </div>

        {/* --- [유지] 기존 개설한/참가한 매치 목록 UI 완벽 보존 --- */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">내가 개설한 매치</h3>
            {myMatches.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">개설한 매치가 없습니다</p>
                <Link href="/match/create" className="inline-block px-6 py-3 bg-sport-blue text-white rounded-lg hover:bg-blue-700 transition-colors font-bold">
                  매치 만들기
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myMatches.map((match) => (
                  <Link key={match.id} href={`/match/${match.id}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getSportEmoji(match.sport_type)}</span>
                      <span className="text-sm font-semibold text-sport-blue">{match.sport_type}</span>
                      <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium ${match.status === 'open' ? 'bg-sport-green text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {match.status === 'open' ? '모집 중' : '종료'}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 mb-2">{match.title}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(match.match_date), 'M/d HH:mm', { locale: ko })}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {match.location}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">참가한 매치</h3>
            {participatedMatches.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">참가한 매치가 없습니다</p>
                <Link href="/" className="inline-block px-6 py-3 bg-sport-blue text-white rounded-lg hover:bg-blue-700 transition-colors font-bold">
                  매치 둘러보기
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {participatedMatches.map((match) => (
                  <Link key={match.id} href={`/match/${match.id}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getSportEmoji(match.sport_type)}</span>
                      <span className="text-sm font-semibold text-sport-blue">{match.sport_type}</span>
                    </div>
                    <p className="font-medium text-gray-900 mb-2">{match.title}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(match.match_date), 'M/d HH:mm', { locale: ko })}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {match.location}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
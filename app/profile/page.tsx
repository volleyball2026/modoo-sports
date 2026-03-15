'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Match, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { User, Calendar, MapPin, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [participatedMatches, setParticipatedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

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

      // [핵심 추가] 로그인한 사용자의 정보를 profiles 테이블에 자동 저장/업데이트 합니다.
      // 이렇게 해야 다른 사람들이 상세 페이지에서 희성님의 이름과 사진을 볼 수 있습니다!
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

      setUser(user);
      await Promise.all([fetchMyMatches(user.id), fetchParticipatedMatches(user.id)]);
    } catch (error) {
      console.error('사용자 정보 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) return;

    await supabase.auth.signOut();
    router.push('/login');
  }

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
              <h2 className="text-xl font-bold text-gray-900">
                {nickname}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-sport-blue">{myMatches.length}</p>
              <p className="text-sm text-gray-600 mt-1">개설한 매치</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sport-green">
                {participatedMatches.length}
              </p>
              <p className="text-sm text-gray-600 mt-1">참가한 매치</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              내가 개설한 매치
            </h3>
            {myMatches.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">개설한 매치가 없습니다</p>
                <Link
                  href="/match/create"
                  className="inline-block px-6 py-3 bg-sport-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  매치 만들기
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/match/${match.id}`}
                    className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getSportEmoji(match.sport_type)}</span>
                      <span className="text-sm font-semibold text-sport-blue">
                        {match.sport_type}
                      </span>
                      <span
                        className={`ml-auto px-2 py-1 rounded-full text-xs font-medium ${
                          match.status === 'open'
                            ? 'bg-sport-green text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {match.status === 'open' ? '모집 중' : '종료'}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 mb-2">{match.title}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(match.match_date), 'M/d HH:mm', {
                          locale: ko,
                        })}
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
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              참가한 매치
            </h3>
            {participatedMatches.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">참가한 매치가 없습니다</p>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 bg-sport-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  매치 둘러보기
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {participatedMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/match/${match.id}`}
                    className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getSportEmoji(match.sport_type)}</span>
                      <span className="text-sm font-semibold text-sport-blue">
                        {match.sport_type}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 mb-2">{match.title}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(match.match_date), 'M/d HH:mm', {
                          locale: ko,
                        })}
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
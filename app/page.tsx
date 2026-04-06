'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { Search, Calendar, MapPin, Users, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export const revalidate = 0;

export default function HomePage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('전체');

  async function fetchMatches() {
    try {
      setLoading(true);
      // ✅ 매치 정보와 함께 참가자 명수(count)를 효율적으로 가져옵니다.
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          match_participants(count)
        `)
        .order('match_date', { ascending: true });

      if (error) throw error;

      // 가공하여 신청 인원을 match 객체에 포함시킵니다.
      const processedMatches = data.map(match => ({
        ...match,
        current_participants: match.match_participants?.[0]?.count || 0
      }));

      setMatches(processedMatches);
      setFilteredMatches(processedMatches);
    } catch (error) {
      console.error('매치 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    if (selectedSport === '전체') {
      setFilteredMatches(matches);
    } else {
      setFilteredMatches(matches.filter(m => (m.sport === selectedSport || m.sport_type === selectedSport)));
    }
  }, [selectedSport, matches]);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white px-4 pt-6 pb-4 sticky top-0 z-10 shadow-sm max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-sport-blue tracking-tighter">모두의 운동</h1>
          <button className="p-2 bg-gray-50 rounded-full"><Search className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedSport('전체')}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              selectedSport === '전체' ? 'bg-sport-blue text-white shadow-md' : 'bg-gray-100 text-gray-50'
            }`}
          >
            전체
          </button>
          {SPORT_TYPES.map((sport) => (
            <button
              key={sport.value}
              onClick={() => setSelectedSport(sport.value)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                selectedSport === sport.value ? 'bg-sport-blue text-white shadow-md' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {sport.emoji} {sport.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">지금 모집 중인 매치</h2>
          <span className="text-sm text-gray-400 font-medium">{filteredMatches.length}개의 매치</span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 font-medium">매치를 불러오는 중...</div>
        ) : filteredMatches.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold">등록된 매치가 없습니다. <br/>첫 번째 매치를 만들어보세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMatches.map((match) => (
              <Link key={match.id} href={`/match/${match.id}`} className="block group">
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm group-active:scale-[0.98] transition-all space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                      <span className="text-sm">{match.sport === '배구' || match.sport_type === '배구' ? '🏐' : '🏆'}</span>
                      <span className="text-[11px] font-black text-sport-blue uppercase">{match.sport || match.sport_type || '배구'}</span>
                    </div>
                    {/* ✅ 신청 현황 뱃지 강화 */}
                    <span className={`px-3 py-1 text-[10px] font-black rounded-full border ${
                      match.current_participants >= match.max_participants 
                      ? 'bg-red-50 text-red-500 border-red-100' 
                      : 'bg-green-50 text-green-600 border-green-100'
                    }`}>
                      {match.current_participants >= match.max_participants ? '모집 마감' : '모집 중'}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-black text-gray-900 line-clamp-1">{match.title}</h3>
                  
                  <div className="space-y-1.5 text-[11px] font-bold text-gray-400">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-sport-blue" />
                      {format(new Date(match.match_date), 'MM월 dd일 (eee) HH:mm', { locale: ko })}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-sport-blue" />
                      <span className="truncate">{match.location}</span>
                    </p>
                    {/* ✅ 실시간 신청 인원 노출 부분 */}
                    <p className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-sport-blue" />
                      신청 현황: <span className="text-gray-900 font-black">{match.current_participants}</span> / {match.max_participants}명
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Link href="/match/create">
        <button className="fixed bottom-24 right-6 w-16 h-16 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-95 transition-all">
          <Plus className="w-8 h-8" />
        </button>
      </Link>

      <BottomNav />
    </div>
  );
}
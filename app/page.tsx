'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { Search, Calendar, MapPin, Users, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// [핵심] 페이지 접속 시마다 항상 새 데이터를 가져오도록 설정
export const revalidate = 0;

export default function HomePage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('전체');

  // 데이터 페칭 함수 분리
  async function fetchMatches() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true });

      if (error) throw error;
      setMatches(data || []);
      setFilteredMatches(data || []);
    } catch (error) {
      console.error('매치 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatches();
  }, []);

  // 종목 필터링 로직 유지
  useEffect(() => {
    if (selectedSport === '전체') {
      setFilteredMatches(matches);
    } else {
      setFilteredMatches(matches.filter(m => m.sport_type === selectedSport));
    }
  }, [selectedSport, matches]);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 상단 헤더 & 검색 UI 유지 */}
      <header className="bg-white px-4 pt-6 pb-4 sticky top-0 z-10 shadow-sm max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-sport-blue tracking-tighter">모두의 운동</h1>
          <button className="p-2 bg-gray-50 rounded-full"><Search className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* 종목 필터 칩 바 유지 */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedSport('전체')}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              selectedSport === '전체' ? 'bg-sport-blue text-white shadow-md' : 'bg-gray-100 text-gray-500'
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
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm group-active:scale-[0.98] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{SPORT_TYPES.find(s => s.value === match.sport_type)?.emoji}</span>
                      <span className="text-xs font-black text-sport-blue uppercase">{match.sport_type}</span>
                    </div>
                    <span className="px-3 py-1 bg-green-50 text-sport-green text-[11px] font-black rounded-full border border-green-100">
                      모집 중
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-4 line-clamp-1">{match.title}</h3>
                  
                  <div className="grid grid-cols-1 gap-y-2">
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Calendar className="w-4 h-4 text-gray-300" />
                      {format(new Date(match.match_date), 'MM월 dd일 (eee) HH:mm', { locale: ko })}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <MapPin className="w-4 h-4 text-gray-300" />
                      <span className="truncate">{match.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                      <Users className="w-4 h-4 text-gray-300" />
                      정원 {match.max_participants}명
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 플로팅 매치 생성 버튼 추가 */}
      <Link href="/match/create">
        <button className="fixed bottom-24 right-6 w-16 h-16 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center z-30 active:scale-95 transition-all">
          <Plus className="w-8 h-8" />
        </button>
      </Link>

      <BottomNav />
    </div>
  );
}
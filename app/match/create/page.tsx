'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, SPORT_TYPES } from '@/lib/supabase';
import { ArrowLeft, Save, Loader2, Trophy } from 'lucide-react';

export default function CreateMatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [location, setLocation] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(18);
  const [totalSets, setTotalSets] = useState(4); // [추가] 총 세트 수 기본값
  const [sportType, setSportType] = useState('배구');
  const [recruitmentType, setRecruitmentType] = useState('알고리즘');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { error } = await supabase.from('matches').insert([
        {
          title,
          match_date: new Date(matchDate).toISOString(),
          location,
          max_participants: maxParticipants,
          total_sets: totalSets, // [추가]
          sport_type: sportType,
          recruitment_type: recruitmentType,
          manager_id: user.id,
          status: 'open',
          is_lineup_visible: false
        }
      ]);

      if (error) throw error;

      alert('매치가 성공적으로 개설되었습니다! 🏐');
      router.push('/');
    } catch (error: any) {
      alert(`매치 개설 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto items-center gap-4">
        <button onClick={() => router.back()}><ArrowLeft /></button>
        <h1 className="font-bold text-lg">새 매치 만들기</h1>
      </header>

      <main className="max-w-lg mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">종목 선택</label>
            <div className="grid grid-cols-3 gap-2">
              {SPORT_TYPES.map((sport) => (
                <button
                  key={sport.value}
                  type="button"
                  onClick={() => setSportType(sport.value)}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                    sportType === sport.value ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  {sport.emoji} {sport.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">매치 제목</label>
            <input required className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none font-bold"
              value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: [정식1회차] 여순광 배구" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">일시</label>
            <input required type="datetime-local" className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none font-bold"
              value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">장소</label>
            <input required className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none font-bold"
              value={location} onChange={(e) => setLocation(e.target.value)} placeholder="체육관 이름을 입력하세요" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-500 ml-1">총 모집 인원</label>
              <input required type="number" className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none font-bold"
                value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} />
            </div>
            {/* [추가] 총 세트 수 입력 칸 */}
            <div className="space-y-2">
              <label className="text-sm font-black text-sport-blue ml-1 flex items-center gap-1">
                <Trophy className="w-3 h-3"/> 총 진행 세트
              </label>
              <input required type="number" className="w-full p-4 rounded-2xl border-2 border-blue-100 focus:border-sport-blue outline-none font-bold"
                value={totalSets} onChange={(e) => setTotalSets(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">모집 방식</label>
            <div className="flex gap-2">
              {['선착순', '알고리즘'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRecruitmentType(type)}
                  className={`flex-1 py-4 rounded-2xl font-bold border-2 transition-all ${
                    recruitmentType === type ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-2 mt-8 disabled:bg-gray-300">
            {loading ? <Loader2 className="animate-spin" /> : <Save />} 매치 개설하기
          </button>
        </form>
      </main>
    </div>
  );
}
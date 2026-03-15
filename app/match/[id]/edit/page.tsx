'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function EditMatchPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 폼 상태 관리
  const [title, setTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [location, setLocation] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(18);
  const [recruitmentType, setRecruitmentType] = useState('선착순');

  // 1. 기존 매치 데이터 불러오기
  useEffect(() => {
    async function loadMatch() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: match, error } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (error || !match) throw new Error('매치를 찾을 수 없습니다.');
        
        // 방장 권한 확인
        if (match.manager_id !== user?.id) {
          alert('수정 권한이 없습니다.');
          router.push(`/match/${matchId}`);
          return;
        }

        setTitle(match.title);
        // datetime-local 입력을 위해 초 단위 제거 (YYYY-MM-DDTHH:mm)
        setMatchDate(new Date(match.match_date).toISOString().slice(0, 16));
        setLocation(match.location);
        setMaxParticipants(match.max_participants);
        setRecruitmentType(match.recruitment_type);
      } catch (err) {
        alert('데이터를 불러오지 못했습니다.');
        router.back();
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [matchId, router]);

  // 2. 수정 사항 저장하기
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          title,
          match_date: new Date(matchDate).toISOString(),
          location,
          max_participants: maxParticipants,
          recruitment_type: recruitmentType,
        })
        .eq('id', matchId);

      if (error) throw error;

      alert('매치 수정이 완료되었습니다! 🏐');
      router.push(`/match/${matchId}`);
      router.refresh();
    } catch (error) {
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-sport-blue">정보 불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto items-center gap-4">
        <button onClick={() => router.back()}><ArrowLeft /></button>
        <h1 className="font-bold text-lg">매치 정보 수정</h1>
      </header>

      <main className="max-w-lg mx-auto p-6">
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">매치 제목</label>
            <input
              required
              className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none transition-all font-bold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 금요 야간 배구 픽업게임"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">일시</label>
            <input
              required
              type="datetime-local"
              className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none transition-all font-bold"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-gray-500 ml-1">장소</label>
            <input
              required
              className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none transition-all font-bold"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="체육관 이름을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-500 ml-1">모집 인원</label>
              <input
                required
                type="number"
                className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none transition-all font-bold"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-500 ml-1">방식</label>
              <select
                className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-sport-blue outline-none transition-all font-bold appearance-none bg-white"
                value={recruitmentType}
                onChange={(e) => setRecruitmentType(e.target.value)}
              >
                <option value="선착순">선착순</option>
                <option value="알고리즘">알고리즘 (포지션)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-5 bg-sport-blue text-white rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-2 mt-8 disabled:bg-gray-300"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            수정 내용 저장하기
          </button>
        </form>
      </main>
    </div>
  );
}
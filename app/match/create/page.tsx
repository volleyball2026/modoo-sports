'use client';

import { useState } from 'react';
import { supabase, SPORT_TYPES } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/bottom-nav';
import { ArrowLeft, Trophy, Users, Calendar, MapPin, FileText, Link as LinkIcon, Target } from 'lucide-react';

const RECRUITMENT_TYPES = [
  { value: '일반', label: '자유 모집', desc: '포지션 상관없이 선착순으로 모집합니다.' },
  { value: '포지션', label: '포지션 지정', desc: '정해진 포지션별 인원을 모집합니다.' },
  { value: '알고리즘', label: '라인업 알고리즘', desc: '희망 포지션을 받고 공평하게 팀을 나눕니다.' },
];

export default function CreateMatchPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    sport_type: '배구',
    match_date: '',
    location: '',
    max_participants: 12,
    description: '',
    recruitment_type: '일반',
    open_chat_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '사용자',
        avatar_url: user.user_metadata?.avatar_url || '',
      });

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert([{ manager_id: user.id, ...formData, status: 'open' }])
        .select().single();

      if (matchError) throw matchError;

      await supabase.from('match_participants').insert([{ match_id: match.id, user_id: user.id }]);

      alert('매치가 성공적으로 개설되었습니다! 🏐');
      router.push(`/match/${match.id}`);
    } catch (error: any) {
      alert('오류 발생: ' + error.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white px-4 py-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()}><ArrowLeft /></button>
          <h1 className="text-xl font-bold">매치 만들기</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 카드 */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-sport-blue font-bold text-sm mb-2">
              <Trophy className="w-4 h-4" /> 기본 정보
            </div>
            <input type="text" name="title" required placeholder="매치 제목을 입력하세요" value={formData.title} onChange={handleChange} className="w-full text-xl font-black outline-none placeholder:text-gray-200" />
            
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">종목 선택</label>
                <select name="sport_type" value={formData.sport_type} onChange={handleChange} className="w-full font-bold outline-none bg-gray-50 p-3 rounded-xl">
                  {SPORT_TYPES.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">최대 인원</label>
                <input type="number" name="max_participants" value={formData.max_participants} onChange={handleChange} className="w-full font-bold outline-none bg-gray-50 p-3 rounded-xl" />
              </div>
            </div>
          </div>

          {/* 모집 방식 선택 (핵심!) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-orange-500 font-bold text-sm mb-4">
              <Target className="w-4 h-4" /> 모집 방식
            </div>
            <div className="space-y-3">
              {RECRUITMENT_TYPES.map((type) => (
                <label key={type.value} className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${formData.recruitment_type === type.value ? 'border-sport-blue bg-blue-50' : 'border-gray-50 bg-gray-50'}`}>
                  <input type="radio" name="recruitment_type" value={type.value} checked={formData.recruitment_type === type.value} onChange={handleChange} className="mt-1" />
                  <div>
                    <p className="font-bold text-gray-900">{type.label}</p>
                    <p className="text-xs text-gray-500">{type.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 상세 정보 */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 text-gray-400 font-bold text-sm"><Calendar className="w-4 h-4" /> 일시 및 장소</div>
            <input type="datetime-local" name="match_date" required value={formData.match_date} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold" />
            <input type="text" name="location" required placeholder="장소를 입력하세요 (예: 조례초 체육관)" value={formData.location} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl outline-none font-bold" />
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-green-500 font-bold text-sm mb-3"><LinkIcon className="w-4 h-4" /> 오픈채팅 링크</div>
            <input type="url" name="open_chat_url" placeholder="https://open.kakao.com/..." value={formData.open_chat_url} onChange={handleChange} className="w-full p-3 bg-gray-50 rounded-xl outline-none text-sm" />
          </div>

          <button type="submit" className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">
            매치 개설하기
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  );
}
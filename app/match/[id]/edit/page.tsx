'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, SPORT_TYPES } from '@/lib/supabase';
import { ArrowLeft, Calendar, MapPin, Users, FileText, Trophy, Loader2 } from 'lucide-react';

export default function EditMatchPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    sport_type: '',
    match_date: '',
    location: '',
    max_participants: 12,
    description: '',
  });

  // 1. 기존 매치 정보 불러오기
  useEffect(() => {
    async function fetchMatch() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (error) throw error;

        // 방장이 아니면 접근 차단
        if (data.manager_id !== user.id) {
          alert('수정 권한이 없습니다.');
          router.push(`/match/${matchId}`);
          return;
        }

        // 폼 데이터에 기존 값 채우기
        setFormData({
          title: data.title,
          sport_type: data.sport_type,
          match_date: data.match_date,
          location: data.location,
          max_participants: data.max_participants,
          description: data.description || '',
        });
      } catch (error) {
        console.error('불러오기 실패:', error);
        alert('정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchMatch();
  }, [matchId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 2. 수정 내용 저장하기 (UPDATE)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('matches')
        .update({
          title: formData.title,
          sport_type: formData.sport_type,
          match_date: formData.match_date,
          location: formData.location,
          max_participants: formData.max_participants,
          description: formData.description,
        })
        .eq('id', matchId);

      if (error) throw error;

      alert('매치 정보가 수정되었습니다! ✨');
      router.push(`/match/${matchId}`);
      router.refresh();
    } catch (error) {
      console.error('수정 실패:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-sport-blue" />
      <p className="text-gray-500 font-medium">정보를 가져오는 중...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">매치 정보 수정</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-sport-blue" /> 모임 제목
            </label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sport-blue outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-2">종목</label>
              <select
                name="sport_type"
                value={formData.sport_type}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
              >
                {SPORT_TYPES.map((sport) => (
                  <option key={sport.value} value={sport.value}>{sport.emoji} {sport.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-sport-blue" /> 정원
              </label>
              <input
                type="number"
                name="max_participants"
                required
                value={formData.max_participants}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sport-blue" /> 일시
              </label>
              <input
                type="datetime-local"
                name="match_date"
                required
                value={formData.match_date}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sport-blue" /> 장소
              </label>
              <input
                type="text"
                name="location"
                required
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sport-blue" /> 상세 설명
            </label>
            <textarea
              name="description"
              rows={5}
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none resize-none"
            />
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-20 max-w-lg mx-auto">
            <button
              type="submit"
              disabled={updating}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all disabled:bg-gray-400"
            >
              {updating ? '수정 사항 저장 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
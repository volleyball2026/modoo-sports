// app/match/[id]/edit/page.tsx 전체 코드
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Loader2, Plus, Minus, LayoutGrid } from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';

const VOLLEY_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];

export default function EditMatchPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [posConfig, setPosConfig] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchMatch = async () => {
      const { data } = await supabase.from('matches').select('*').eq('id', id).single();
      if (data) {
        setFormData({
          ...data,
          match_date: data.match_date ? data.match_date.substring(0, 16) : ''
        });
        // ✅ 포지션 설정 로드 (없으면 초기화)
        setPosConfig(data.position_settings || VOLLEY_POSITIONS.reduce((acc, pos) => ({ ...acc, [pos]: 0 }), {}));
      }
      setLoading(false);
    };
    fetchMatch();
  }, [id]);

  const handlePosChange = (pos: string, val: number) => {
    setPosConfig(prev => ({ ...prev, [pos]: Math.max(0, val) }));
  };

  // ✅ ✅ 방식이 'position' 이거나 '선착순'일 때 모두 포지션 지정형으로 판단
  const isPosType = formData.recruitment_type === 'position' || formData.recruitment_type === '선착순';

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('matches').update({
        title: formData.title,
        match_date: new Date(formData.match_date).toISOString(),
        location: formData.location,
        max_participants: formData.max_participants,
        // 포지션 지정형일 때만 T.O 저장
        position_settings: isPosType ? posConfig : null
      }).eq('id', id);

      if (error) throw error;
      alert('매치 정보가 수정되었습니다! 🏐');
      router.push(`/match/${id}`);
    } catch (e: any) { alert(`실패: ${e.message}`); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center font-black">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto justify-between items-center">
        <button onClick={() => router.back()}><ArrowLeft /></button>
        <h1 className="text-lg font-black">매치 정보 수정</h1>
        <div className="w-5" />
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <form onSubmit={handleUpdate} className="space-y-6">
          <section className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4">
             {/* 기본 정보 필드들 (생략 - 기존과 동일) */}
             <div className="space-y-1.5">
               <label className="text-[11px] font-black text-gray-400">매치 제목</label>
               <input className="w-full p-4 rounded-2xl border-2 bg-gray-50 font-bold" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
             </div>
             <div className="space-y-1.5">
               <label className="text-[11px] font-black text-gray-400">일시</label>
               <input type="datetime-local" className="w-full p-4 rounded-2xl border-2 bg-gray-50 font-bold" value={formData.match_date} onChange={e => setFormData({...formData, match_date: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                 <label className="text-[11px] font-black text-gray-400">모집 인원</label>
                 <input type="number" className="w-full p-4 rounded-2xl border-2 bg-gray-50 font-bold" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-[11px] font-black text-gray-400">모집 방식</label>
                 <div className="w-full p-4 rounded-2xl border-2 bg-gray-100 font-bold text-gray-400 select-none">{formData.recruitment_type}</div>
               </div>
             </div>
          </section>

          {/* ✅ ✅ ✅ 포지션 T.O 수정 섹션 (스샷2 문제 해결) */}
          {isPosType && (
            <section className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4">
              <h3 className="font-black text-sm text-sport-blue flex items-center gap-2 ml-1">
                <LayoutGrid className="w-4 h-4" /> 포지션별 모집 인원(T.O) 수정
              </h3>
              <div className="grid grid-cols-1 gap-2.5">
                {VOLLEY_POSITIONS.map(pos => (
                  <div key={pos} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-[20px] border border-gray-100">
                    <span className="font-black text-sm text-gray-700 ml-2">{pos}</span>
                    <div className="flex items-center gap-4 bg-white rounded-full px-2 py-1 border shadow-sm">
                      <button type="button" onClick={() => handlePosChange(pos, (posConfig[pos] || 0) - 1)} className="p-1 text-gray-300 hover:text-red-500"><Minus className="w-4 h-4"/></button>
                      <span className="font-black text-sm min-w-[20px] text-center">{posConfig[pos] || 0}</span>
                      <button type="button" onClick={() => handlePosChange(pos, (posConfig[pos] || 0) + 1)} className="p-1 text-sport-blue hover:scale-110"><Plus className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button disabled={saving} type="submit" className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black text-xl shadow-xl flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" /> : '수정 내용 저장하기'}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Plus, Minus, Save, Users, Calendar, MapPin, 
  ClipboardList, CheckCircle2, LayoutGrid, Loader2 
} from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';

const POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];

export default function CreateMatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recruitmentType, setRecruitmentType] = useState<'general' | 'position'>('general');
  
  const [formData, setFormData] = useState({
    title: '',
    match_date: '',
    location: '',
    max_participants: 12,
    description: ''
  });

  // ✅ 포지션 지정 모집 시 사용할 각 포지션별 정원 상태
  const [posConfig, setPosConfig] = useState<Record<string, number>>(
    POSITIONS.reduce((acc, pos) => ({ ...acc, [pos]: 0 }), {})
  );

  const handlePosChange = (pos: string, val: number) => {
    setPosConfig(prev => ({ ...prev, [pos]: Math.max(0, val) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      // 1. 매치 데이터 생성
      const { data, error } = await supabase.from('matches').insert([{
        ...formData,
        manager_id: user.id,
        recruitment_type: recruitmentType,
        // 포지션 지정 모집일 때만 설정값 저장
        position_settings: recruitmentType === 'position' ? posConfig : null,
        is_lineup_visible: false
      }]).select().single();

      if (error) throw error;
      
      alert('매치가 성공적으로 개설되었습니다! 🏐');
      router.push(`/match/${data.id}`);
    } catch (error: any) {
      alert(`개설 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto justify-between items-center font-bold shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}><ArrowLeft className="w-5 h-5"/></button>
          <h1 className="text-lg font-black">새 매치 개설하기</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 1️⃣ 기본 매치 정보 섹션 */}
          <section className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4">
            <h3 className="font-black text-sm text-sport-blue flex items-center gap-2 ml-1">
              <InfoIcon className="w-4 h-4" /> 필수 정보 입력
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 ml-1">매치 제목</label>
              <input required className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold transition-all" 
                placeholder="예: 조례초 화요 배구 픽업"
                value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-gray-400 ml-1">일시</label>
                <input required type="datetime-local" className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold text-sm" 
                  value={formData.match_date} onChange={e => setFormData({...formData, match_date: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-gray-400 ml-1">최대 정원</label>
                <input required type="number" className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold" 
                  value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: parseInt(e.target.value)})} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 ml-1">장소</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input required className="w-full p-4 pl-10 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold transition-all" 
                  placeholder="예: 순천조례초 체육관"
                  value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
            </div>
          </section>

          {/* 2️⃣ 모집 방식 선택 섹션 */}
          <section className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4">
            <h3 className="font-black text-sm text-sport-blue flex items-center gap-2 ml-1">
              <ClipboardList className="w-4 h-4" /> 모집 방식 상세 설정
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" 
                onClick={() => setRecruitmentType('general')}
                className={`p-5 rounded-2xl border-2 font-black transition-all flex flex-col items-center gap-2 ${recruitmentType === 'general' ? 'border-sport-blue bg-blue-50 text-sport-blue shadow-md' : 'border-gray-100 bg-white text-gray-300'}`}>
                <Users className="w-5 h-5" />
                <span className="text-sm">일반 모집</span>
              </button>
              <button type="button" 
                onClick={() => setRecruitmentType('position')}
                className={`p-5 rounded-2xl border-2 font-black transition-all flex flex-col items-center gap-2 ${recruitmentType === 'position' ? 'border-sport-blue bg-blue-50 text-sport-blue shadow-md' : 'border-gray-100 bg-white text-gray-300'}`}>
                <LayoutGrid className="w-5 h-5" />
                <span className="text-sm">포지션 지정</span>
              </button>
            </div>

            {/* 방식별 상세 설명 및 입력 필드 */}
            {recruitmentType === 'general' ? (
              <div className="p-5 bg-blue-50/30 rounded-2xl border-2 border-dashed border-blue-100">
                <p className="text-[12px] font-bold text-gray-500 leading-relaxed">
                  📢 <span className="text-sport-blue">일반 모집</span>이란?<br/>
                  - 참가자들은 <span className="text-gray-900 font-black text-xs">'참가 가능 세트'</span>만 선택합니다.<br/>
                  - 구체적인 포지션 배정은 경기 당일 방장님이 <span className="text-gray-900 font-black text-xs">알고리즘 버튼</span>을 눌러 생성합니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 mb-2">
                  <p className="text-[11px] font-bold text-orange-600 leading-relaxed">
                    📢 <span className="font-black text-xs">포지션 지정 모집</span>이란?<br/>
                    - 방장님이 포지션별 인원을 미리 정해놓습니다.<br/>
                    - 참가자는 신청 시 남은 자리(T.O) 중 하나를 선착순으로 선택합니다.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {POSITIONS.map(pos => (
                    <div key={pos} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-[20px] border border-gray-100">
                      <span className="font-black text-sm text-gray-700 ml-2">{pos}</span>
                      <div className="flex items-center gap-4 bg-white rounded-full px-2 py-1 border shadow-sm">
                        <button type="button" onClick={() => handlePosChange(pos, posConfig[pos] - 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"><Minus className="w-4 h-4"/></button>
                        <span className="font-black text-base min-w-[20px] text-center">{posConfig[pos]}</span>
                        <button type="button" onClick={() => handlePosChange(pos, posConfig[pos] + 1)} className="w-8 h-8 rounded-full flex items-center justify-center text-sport-blue hover:scale-110 transition-transform"><Plus className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <button disabled={loading} type="submit" className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black text-xl shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : '새로운 매치 개설하기 🏐'}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  );
}

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
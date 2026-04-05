'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Plus, Minus, Users, Calendar, MapPin, 
  ClipboardList, LayoutGrid, Loader2, Zap, Trophy
} from 'lucide-react';
import { BottomNav } from '@/components/bottom-nav';

const SPORTS = ["배구", "농구", "축구", "배드민턴"];
const VOLLEY_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];

export default function CreateMatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedSport, setSelectedSport] = useState('배구');
  const [recruitmentType, setRecruitmentType] = useState<'general' | 'position' | 'algorithm'>('algorithm');
  
  const [formData, setFormData] = useState({
    title: '',
    match_date: '',
    location: '',
    max_participants: 12,
    description: ''
  });

  // 포지션 지정 모집용 T.O 설정
  const [posConfig, setPosConfig] = useState<Record<string, number>>(
    VOLLEY_POSITIONS.reduce((acc, pos) => ({ ...acc, [pos]: 0 }), {})
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

      const { data, error } = await supabase.from('matches').insert([{
        ...formData,
        manager_id: user.id,
        sport: selectedSport,
        recruitment_type: recruitmentType,
        position_settings: recruitmentType === 'position' ? posConfig : null,
        is_lineup_visible: false
      }]).select().single();

      if (error) throw error;
      
      alert(`${selectedSport} 매치가 개설되었습니다! 🏐🔥`);
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
          <h1 className="text-lg font-black">매치 개설하기</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 1️⃣ 종목 선택 섹션 */}
          <section className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4">
            <h3 className="font-black text-sm text-sport-blue flex items-center gap-2 ml-1">
              <Trophy className="w-4 h-4" /> 종목 선택
            </h3>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map(s => (
                <button key={s} type="button" onClick={() => setSelectedSport(s)}
                  className={`px-6 py-3 rounded-2xl font-black text-sm transition-all border-2 ${selectedSport === s ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-50 bg-gray-50 text-gray-400'}`}>
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* 2️⃣ 매치 기본 정보 */}
          <section className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-gray-400 ml-1">매치 제목</label>
              <input required className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold" 
                placeholder="예: 조례초 배구 픽업" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input required type="datetime-local" className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold text-sm" 
                value={formData.match_date} onChange={e => setFormData({...formData, match_date: e.target.value})} />
              <input required type="number" className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold" 
                placeholder="정원" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: parseInt(e.target.value)})} />
            </div>
            <input required className="w-full p-4 rounded-2xl border-2 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none font-bold" 
              placeholder="장소 입력" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
          </section>

          {/* 3️⃣ 배구 전용 모집 방식 (배구일 때만 노출) */}
          {selectedSport === '배구' && (
            <section className="bg-white p-6 rounded-[32px] shadow-sm border space-y-4">
              <h3 className="font-black text-sm text-sport-blue flex items-center gap-2 ml-1">
                <ClipboardList className="w-4 h-4" /> 배구 모집 방식 설정
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <RecruitTab active={recruitmentType === 'general'} icon={<Users className="w-4 h-4"/>} label="일반" onClick={() => setRecruitmentType('general')} />
                <RecruitTab active={recruitmentType === 'position'} icon={<LayoutGrid className="w-4 h-4"/>} label="포지션" onClick={() => setRecruitmentType('position')} />
                <RecruitTab active={recruitmentType === 'algorithm'} icon={<Zap className="w-4 h-4"/>} label="알고리즘" onClick={() => setRecruitmentType('algorithm')} />
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl text-[11px] font-bold text-gray-500 leading-relaxed">
                {recruitmentType === 'general' && "📢 [일반] 참가자는 참가 세트만 입력합니다."}
                {recruitmentType === 'position' && "📢 [포지션 지정] 방장이 설정한 포지션 T.O에 선착순 지원합니다."}
                {recruitmentType === 'algorithm' && "📢 [알고리즘] 참가자의 1~3지망을 받아 최적의 라인업을 생성합니다."}
              </div>

              {recruitmentType === 'position' && (
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {VOLLEY_POSITIONS.map(pos => (
                    <div key={pos} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                      <span className="font-black text-xs text-gray-600 ml-2">{pos}</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => handlePosChange(pos, posConfig[pos] - 1)} className="p-1 text-gray-300"><Minus className="w-4 h-4"/></button>
                        <span className="font-black text-sm w-4 text-center">{posConfig[pos]}</span>
                        <button type="button" onClick={() => handlePosChange(pos, posConfig[pos] + 1)} className="p-1 text-sport-blue"><Plus className="w-4 h-4"/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <button disabled={loading} type="submit" className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black text-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : '매치 개설 완료하기'}
          </button>
        </form>
      </main>
      <BottomNav />
    </div>
  );
}

function RecruitTab({ active, icon, label, onClick }: any) {
  return (
    <button type="button" onClick={onClick}
      className={`py-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${active ? 'border-sport-blue bg-blue-50 text-sport-blue shadow-sm' : 'border-gray-50 bg-white text-gray-300'}`}>
      {icon}
      <span className="text-[10px] font-black">{label}</span>
    </button>
  );
}
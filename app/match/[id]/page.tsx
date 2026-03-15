'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X 
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 여순광 픽업게임 실제 9인제 배구 포지션 리스트
const VOLLEYBALL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백", "상관없음"];

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [match, setMatch] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState('');

  // 1. 데이터 불러오기 (매치 정보 + 참여자 명단)
  const fetchMatchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single();
      setMatch(matchData);

      const { data: partData } = await supabase.from('match_participants')
        .select('*, profiles(full_name, avatar_url)')
        .eq('match_id', matchId);
      setParticipants(partData || []);
    } catch (error) {
      console.error('데이터 로딩 에러:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatchDetails();
  }, [fetchMatchDetails]);

  const isJoined = participants.some((p) => p.user_id === user?.id);
  const isManager = user?.id === match?.manager_id;

  // 2. 관리자 기능: 매치 삭제 (에러 추적 강화)
  const deleteMatch = async () => {
    if (!confirm('정말로 이 매치를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) return;
    try {
      const { error } = await supabase.from('matches').delete().eq('id', matchId);
      
      // 에러가 있으면 여기서 정확한 이유를 알림창으로 띄워줍니다.
      if (error) {
        alert(`❌ DB 삭제 실패: ${error.message} (코드: ${error.code})`);
        return;
      }
      
      alert('매치가 성공적으로 삭제되었습니다. 🏐');
      // 캐시를 완전히 무시하고 메인 화면으로 강제 이동 및 새로고침
      window.location.href = '/'; 
    } catch (error: any) {
      alert(`❌ 코드 실행 실패: ${error.message}`);
    }
  };

  // 3. 참여 신청 및 취소 로직
  async function submitJoin(position: string = '') {
    try {
      const { error } = await supabase.from('match_participants').insert([{ 
        match_id: matchId, 
        user_id: user.id,
        position: position 
      }]);
      if (error) throw error;
      
      alert('참가 신청 완료! 🏐');
      setShowPositionModal(false);
      fetchMatchDetails();
    } catch (error) {
      alert('신청 중 오류가 발생했습니다.');
    }
  }

  const handleJoinToggle = async () => {
    if (!user) { alert('로그인이 필요합니다.'); router.push('/login'); return; }

    if (isJoined) {
      if (isManager) { alert('방장은 참여 취소가 불가능합니다. 매치 삭제를 이용해 주세요.'); return; }
      if (confirm('참여를 취소하시겠습니까?')) {
        await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', user.id);
        fetchMatchDetails();
      }
    } else {
      if (match.recruitment_type === '알고리즘') setShowPositionModal(true);
      else submitJoin();
    }
  };

  // 4. 라인업 생성 알고리즘 (파이썬 스네이크 드래프트 로직 이식)
  const generateLineup = async () => {
    if (!confirm('새로운 라인업을 자동 생성하시겠습니까?')) return;
    
    // 실력 점수(랜덤 가중치 포함) 기준 정렬
    let players = [...participants].map(p => ({ ...p, score: 50 + Math.random() * 10 }))
                                   .sort((a, b) => b.score - a.score);

    // 1~4라운드(총 8세트분) 생성
    for (let r = 1; r <= 4; r++) {
      let teamA: any[] = [];
      let teamB: any[] = [];
      
      // 스네이크 드래프트 분배
      players.forEach((p, idx) => {
        if ((idx % 4 === 0) || (idx % 4 === 3)) teamA.push(p);
        else teamB.push(p);
      });

      const assignPos = (team: any[]) => {
        let available = [...VOLLEYBALL_POSITIONS].filter(p => p !== "상관없음");
        return team.map(p => {
          let pos = p.position !== "상관없음" && available.includes(p.position) ? p.position : (available.shift() || '대기');
          available = available.filter(v => v !== pos);
          return { id: p.id, pos };
        });
      };

      const results = [...assignPos(teamA).map(res => ({...res, team: 'A팀'})), 
                       ...assignPos(teamB).map(res => ({...res, team: 'B팀'}))];
      
      for (const res of results) {
        await supabase.from('match_participants')
          .update({ [`team_r${r}`]: res.team, [`pos_r${r}`]: res.pos })
          .eq('id', res.id);
      }
    }
    alert('여순광 배구 라인업 생성 완료!');
    fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center font-bold text-sport-blue">데이터 로딩 중...</div>;
  if (!match) return <div className="p-10 text-center">매치를 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-44">
      {/* 헤더: 뒤로가기, 제목, 관리기능(눈, 수정, 삭제) */}
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}><ArrowLeft /></button>
          <h1 className="font-bold text-lg">매치 상세</h1>
        </div>
        {isManager && (
          <div className="flex items-center gap-4">
            <button onClick={() => supabase.from('matches').update({ is_lineup_visible: !match.is_lineup_visible }).eq('id', matchId).then(() => fetchMatchDetails())}>
              {match.is_lineup_visible ? <EyeOff className="text-gray-400 w-5 h-5"/> : <Eye className="text-sport-blue w-5 h-5"/>}
            </button>
            <button onClick={() => router.push(`/match/${matchId}/edit`)}><Edit3 className="text-gray-600 w-5 h-5" /></button>
            <button onClick={deleteMatch}><Trash2 className="text-red-500 w-5 h-5" /></button>
          </div>
        )}
      </header>

      {/* 상단 탭 */}
      <div className="bg-white border-b sticky top-14 z-20">
        <div className="flex max-w-lg mx-auto">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 font-bold ${activeTab === 'info' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>정보</button>
          <button onClick={() => setActiveTab('lineup')} className={`flex-1 py-4 font-bold ${activeTab === 'lineup' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>라인업</button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {activeTab === 'info' ? (
          <>
            <div className="bg-white p-6 rounded-3xl shadow-sm border">
               <h2 className="text-2xl font-black mb-4 leading-tight">{match.title}</h2>
               <div className="space-y-3 text-sm text-gray-600">
                 <p className="flex items-center gap-2 font-bold"><Calendar className="w-4 h-4 text-sport-blue"/> {format(new Date(match.match_date), 'M월 d일 (EEEE) HH:mm', { locale: ko })}</p>
                 <p className="flex items-center gap-2 font-bold"><MapPin className="w-4 h-4 text-sport-blue"/> {match.location}</p>
                 <p className="flex items-center gap-2 font-bold"><Users className="w-4 h-4 text-sport-blue"/> {participants.length} / {match.max_participants}명</p>
               </div>
            </div>

            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2">
                <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400"/> 라인업 자동 생성
              </button>
            )}

            <div>
              <h3 className="font-black text-lg mb-4 px-1">참여자 명단</h3>
              <div className="grid grid-cols-2 gap-3">
                {participants.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border shadow-sm">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center"><User className="text-sport-blue w-5 h-5"/></div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold truncate">{p.profiles?.full_name}</p>
                      <p className="text-[10px] text-sport-green font-bold uppercase tracking-widest">{p.position || 'PLAYER'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-8">
            {(match.is_lineup_visible || isManager) ? (
              [1, 2, 3, 4].map(r => (
                <div key={r} className="space-y-4">
                  <h3 className="font-black text-lg text-sport-blue bg-blue-50 p-3 rounded-xl inline-block">{r*2-1}·{r*2}세트 라인업</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {['A팀', 'B팀'].map(t => (
                      <div key={t} className={`p-5 rounded-3xl border-2 ${t === 'A팀' ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`}>
                        <p className={`font-black text-sm mb-4 ${t === 'A팀' ? 'text-red-500' : 'text-blue-500'}`}>{t} 코트</p>
                        <div className="grid grid-cols-3 gap-2">
                          {participants.filter(p => p[`team_r${r}`] === t).map(p => (
                            <div key={p.id} className="bg-white p-2 rounded-xl shadow-sm text-center border border-gray-100">
                              <p className="text-[9px] text-gray-400 font-black mb-1">{p[`pos_r${r}`]}</p>
                              <p className="text-xs font-bold truncate">{p.profiles?.full_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 text-gray-400 font-bold">라인업이 아직 비공개 상태입니다. 🕵️‍♂️</div>
            )}
          </div>
        )}
      </main>

      {/* 포지션 선택 모달 */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-[40px] p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black">주 포지션 선택</h3>
              <button onClick={() => setShowPositionModal(false)}><X className="w-8 h-8 text-gray-300"/></button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {VOLLEYBALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`py-4 rounded-2xl font-bold text-sm transition-all border-2 ${
                    selectedPosition === pos ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-50 bg-gray-50 text-gray-500'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
            <button onClick={() => submitJoin(selectedPosition)} disabled={!selectedPosition} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xl shadow-xl disabled:bg-gray-200">신청 완료</button>
          </div>
        </div>
      )}

      {/* 하단 참가 버튼 */}
      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto z-10 bg-gradient-to-t from-gray-50 pt-10">
        <button onClick={handleJoinToggle} className={`w-full py-5 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-95 ${isJoined ? 'bg-gray-200 text-gray-500' : 'bg-sport-blue text-white'}`}>
          {isJoined ? '참여 취소하기' : '지금 참가 신청하기'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const VOLLEYBALL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];
const OPTIONAL_POSITIONS = ["선택 안함", ...VOLLEYBALL_POSITIONS];

// 포지션 이름을 줄여주는 마법의 함수 (예: 레프트 -> 레, 레프트백 -> 레백)
const getShortPos = (pos: string) => {
  const map: Record<string, string> = { 
    '레프트':'레', '속공':'속', '세터':'세', '라이트':'라', '앞차':'앞', 
    '백차':'백', '레프트백':'레백', '센터백':'센백', '라이트백':'라백' 
  };
  return map[pos] || pos;
};

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [match, setMatch] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null); // 내 프로필 정보 저장용
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  
  // 모달 및 신청 폼 상태
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
    pos_1st: '레프트',
    pos_2nd: '선택 안함',
    pos_3rd: '선택 안함',
    pos_exclude: '선택 안함'
  });

  // 1. 데이터 불러오기 (매치 정보 + 참여자 명단 + 내 프로필)
  const fetchMatchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      // 내 프로필 정보 가져오기 (불러오기 버튼을 위해)
      if (currentUser) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        setUserProfile(profileData);
      }

      const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single();
      setMatch(matchData);

      const { data: partData } = await supabase.from('match_participants')
        .select('*, profiles(full_name, avatar_url, skill_level)')
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

  // 2. 관리자 기능: 매치 삭제 (기존 유지)
  const deleteMatch = async () => {
    if (!confirm('정말로 이 매치를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) return;
    try {
      const { error } = await supabase.from('matches').delete().eq('id', matchId);
      if (error) {
        alert(`❌ DB 삭제 실패: ${error.message} (코드: ${error.code})`);
        return;
      }
      alert('매치가 성공적으로 삭제되었습니다. 🏐');
      window.location.href = '/'; 
    } catch (error: any) {
      alert(`❌ 코드 실행 실패: ${error.message}`);
    }
  };

  // 3. 참여 신청 및 취소 로직 (1~3순위 저장으로 업그레이드)
  async function submitJoin() {
    try {
      const { error } = await supabase.from('match_participants').insert([{ 
        match_id: matchId, 
        user_id: user.id,
        pos_1st: joinForm.pos_1st,
        pos_2nd: joinForm.pos_2nd,
        pos_3rd: joinForm.pos_3rd,
        pos_exclude: joinForm.pos_exclude
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
      else submitJoin(); // 선착순일 경우 기존처럼 바로 신청
    }
  };

  // [추가] 프로필에서 포지션 불러오기 기능
  const loadProfilePositions = () => {
    if (!userProfile?.preferred_position) {
      alert('프로필에 설정된 배구 포지션이 없습니다. 프로필에서 먼저 설정해주세요.');
      return;
    }
    // "세터,레프트" 형태로 저장된 문자열을 배열로 변환
    const posArray = userProfile.preferred_position.split(',');
    
    setJoinForm({
      pos_1st: posArray[0] || '레프트',
      pos_2nd: posArray[1] || '선택 안함',
      pos_3rd: posArray[2] || '선택 안함',
      pos_exclude: '선택 안함'
    });
    alert('프로필에 설정한 포지션을 불러왔습니다!');
  };

  // 4. 라인업 생성 알고리즘 (일단 1순위 포지션 기반으로 임시 연동)
  const generateLineup = async () => {
    if (!confirm('새로운 라인업을 자동 생성하시겠습니까?')) return;
    
    let players = [...participants].map(p => ({ ...p, score: 50 + Math.random() * 10 })).sort((a, b) => b.score - a.score);

    for (let r = 1; r <= 4; r++) {
      let teamA: any[] = [];
      let teamB: any[] = [];
      
      players.forEach((p, idx) => {
        if ((idx % 4 === 0) || (idx % 4 === 3)) teamA.push(p);
        else teamB.push(p);
      });

      const assignPos = (team: any[]) => {
        let available = [...VOLLEYBALL_POSITIONS];
        return team.map(p => {
          // 우선 1순위 포지션을 배정 시도합니다.
          let pos = available.includes(p.pos_1st) ? p.pos_1st : (available.shift() || '대기');
          available = available.filter(v => v !== pos);
          return { id: p.id, pos };
        });
      };

      const results = [...assignPos(teamA).map(res => ({...res, team: 'A팀'})), ...assignPos(teamB).map(res => ({...res, team: 'B팀'}))];
      
      for (const res of results) {
        await supabase.from('match_participants').update({ [`team_r${r}`]: res.team, [`pos_r${r}`]: res.pos }).eq('id', res.id);
      }
    }
    alert('여순광 배구 라인업 생성 완료!');
    fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center font-bold text-sport-blue">데이터 로딩 중...</div>;
  if (!match) return <div className="p-10 text-center">매치를 찾을 수 없습니다.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-44">
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
              <h3 className="font-black text-lg mb-4 px-1">신청자 명단 ({participants.length}명)</h3>
              <div className="grid grid-cols-1 gap-3">
                {participants.map((p, idx) => {
                  // 옛날 앱처럼 포지션 압축 텍스트 생성 (예: 레-앞-속)
                  const posList = [p.pos_1st, p.pos_2nd, p.pos_3rd].filter(x => x && x !== '선택 안함');
                  const shortPosText = posList.map(getShortPos).join('-');

                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border shadow-sm">
                      {p.profiles?.avatar_url ? (
                        <img src={p.profiles.avatar_url} alt="프로필" className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                          <User className="text-sport-blue w-5 h-5"/>
                        </div>
                      )}
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">{p.profiles?.full_name}</p>
                        <p className="text-xs text-gray-500 font-medium">
                          {p.profiles?.skill_level || '입문'} <span className="text-gray-300">·</span> <span className="text-sport-blue font-bold">{shortPosText || '미지정'}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
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

      {/* --- 업그레이드된 참가 신청 모달 (1~3순위 및 프로필 불러오기) --- */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-[40px] p-6 pb-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black">포지션 희망서</h3>
              <button onClick={() => setShowPositionModal(false)}><X className="w-8 h-8 text-gray-300"/></button>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl mb-6">
              <p className="text-xs font-bold text-sport-blue leading-relaxed">
                💡 2순위와 3순위(수비/속공)까지 꽉 채워주셔야 희망 포지션 배정 확률이 높아지고, 알고리즘 가산점(+)도 챙길 수 있습니다!
              </p>
            </div>

            <button 
              onClick={loadProfilePositions}
              className="w-full mb-6 py-3 border-2 border-sport-blue text-sport-blue rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
            >
              <Download className="w-4 h-4" /> 내 프로필 포지션 불러오기
            </button>

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-sm font-black text-gray-700 ml-1">1순위 (필수)</label>
                <select className="w-full mt-1 p-4 rounded-2xl border-2 border-gray-100 font-bold outline-none focus:border-sport-blue bg-white"
                  value={joinForm.pos_1st} onChange={(e) => setJoinForm({...joinForm, pos_1st: e.target.value})}>
                  {VOLLEYBALL_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-black text-gray-700 ml-1">2순위 (차선책)</label>
                  <select className="w-full mt-1 p-4 rounded-2xl border-2 border-gray-100 font-bold outline-none focus:border-sport-blue bg-white"
                    value={joinForm.pos_2nd} onChange={(e) => setJoinForm({...joinForm, pos_2nd: e.target.value})}>
                    {OPTIONAL_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-black text-gray-700 ml-1">3순위 <span className="text-sport-green">(가산점+)</span></label>
                  <select className="w-full mt-1 p-4 rounded-2xl border-2 border-gray-100 font-bold outline-none focus:border-sport-blue bg-white"
                    value={joinForm.pos_3rd} onChange={(e) => setJoinForm({...joinForm, pos_3rd: e.target.value})}>
                    {OPTIONAL_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="text-sm font-black text-red-400 ml-1">제외할 포지션 (선택)</label>
                <select className="w-full mt-1 p-4 rounded-2xl border-2 border-red-50 text-red-500 font-bold outline-none focus:border-red-400 bg-white"
                  value={joinForm.pos_exclude} onChange={(e) => setJoinForm({...joinForm, pos_exclude: e.target.value})}>
                  {OPTIONAL_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
            </div>

            <button onClick={submitJoin} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform">
              신청 완료
            </button>
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
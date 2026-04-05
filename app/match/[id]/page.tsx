'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X, Download, BarChart3, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const VOLLEYBALL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백", "상관없음"];
const REAL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];
const OPTIONAL_POSITIONS = ["선택 안함", ...VOLLEYBALL_POSITIONS];
const BONUS_POSITIONS = ["선택 안함", "속공", "레프트백", "센터백", "라이트백"];

const getShortPos = (pos: string) => {
  const map: Record<string, string> = { 
    '레프트':'레', '속공':'속', '세터':'세', '라이트':'라', '앞차':'앞', 
    '백차':'백', '레프트백':'레백', '센터백':'센백', '라이트백':'라백' 
  };
  return map[pos] || pos;
};

const getSkillScore = (level: string) => {
  const scores: Record<string, number> = { '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 };
  return scores[level] || 50;
};

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [match, setMatch] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
    pos_1st: '레프트',
    pos_2nd: '선택 안함',
    pos_3rd: '선택 안함',
    pos_exclude: '선택 안함',
    available_sets: [] as string[] // 숫자가 섞일 수 있어 string으로 통합 관리
  });

  const fetchMatchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        await supabase.from('profiles').upsert({
          id: currentUser.id,
          full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '사용자',
          avatar_url: currentUser.user_metadata?.avatar_url || '',
        });

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

  const deleteMatch = async () => {
    if (!confirm('정말로 이 매치를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('matches').delete().eq('id', matchId);
      if (error) throw error;
      alert('매치가 성공적으로 삭제되었습니다.');
      window.location.href = '/'; 
    } catch (error: any) {
      alert(`❌ 삭제 실패: ${error.message}`);
    }
  };

  async function submitJoin() {
    if (joinForm.available_sets.length === 0) {
      alert('최소 1개 이상의 세트를 선택해 주세요.');
      return;
    }

    try {
      const payload = {
        match_id: matchId, 
        user_id: user.id,
        pos_1st: joinForm.pos_1st,
        pos_2nd: joinForm.pos_2nd,
        pos_3rd: joinForm.pos_3rd,
        pos_exclude: joinForm.pos_exclude,
        available_sets: joinForm.available_sets.join(',')
      };

      if (isJoined) {
        const myData = participants.find(p => p.user_id === user.id);
        const { error } = await supabase.from('match_participants').update(payload).eq('id', myData.id);
        if (error) throw error;
        alert('신청 내용이 수정되었습니다! 🏐');
      } else {
        const { error } = await supabase.from('match_participants').insert([payload]);
        if (error) throw error;
        alert('참가 신청 완료! 🏐');
      }
      
      setShowPositionModal(false);
      fetchMatchDetails();
    } catch (error: any) {
      alert(`❌ 신청 실패: ${error.message || '알 수 없는 DB 오류'}`);
    }
  }

  const openJoinModal = () => {
    if (!user) { alert('로그인이 필요합니다.'); router.push('/login'); return; }

    const maxSets = Math.min(6, match?.total_sets || 4);
    const initialSets = Array.from({length: maxSets}, (_, i) => String(i + 1));

    if (isJoined) {
      const myData = participants.find(p => p.user_id === user.id);
      setJoinForm({
        pos_1st: myData.pos_1st || '레프트',
        pos_2nd: myData.pos_2nd || '선택 안함',
        pos_3rd: myData.pos_3rd || '선택 안함',
        pos_exclude: myData.pos_exclude || '선택 안함',
        available_sets: myData.available_sets ? myData.available_sets.split(',') : initialSets
      });
    } else {
      setJoinForm({
        pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함', pos_exclude: '선택 안함',
        available_sets: initialSets
      });
    }
    setShowPositionModal(true);
  };

  const handleCancelJoin = async () => {
    if (isManager) { alert('방장은 참여 취소가 불가능합니다.'); return; }
    if (confirm('참여를 취소하시겠습니까?')) {
      await supabase.from('match_participants').delete().eq('match_id', matchId).eq('user_id', user.id);
      fetchMatchDetails();
    }
  };

  const loadProfilePositions = () => {
    if (!userProfile?.preferred_position) {
      alert('프로필에 설정된 배구 포지션이 없습니다.');
      return;
    }
    const posArray = userProfile.preferred_position.split(',');
    setJoinForm({
      ...joinForm,
      pos_1st: posArray[0] || '레프트',
      pos_2nd: posArray[1] || '선택 안함',
      pos_3rd: '선택 안함'
    });
    alert('프로필 정보를 불러왔습니다!');
  };

  const generateLineup = async () => {
    if (!confirm('알고리즘으로 라인업을 생성하시겠습니까?')) return;
    
    let basePlayers = [...participants].map(p => {
      let score = getSkillScore(p.profiles?.skill_level);
      if (p.pos_3rd && p.pos_3rd !== '선택 안함') score += 5;
      return { ...p, baseScore: score };
    });

    for (let r = 1; r <= 4; r++) {
      let players = basePlayers.map(p => ({ ...p, currentScore: p.baseScore + Math.random() * 5 })).sort((a, b) => b.currentScore - a.currentScore);
      let teamA: any[] = [];
      let teamB: any[] = [];
      
      players.forEach((p, idx) => {
        if ((idx % 4 === 0) || (idx % 4 === 3)) teamA.push(p);
        else teamB.push(p);
      });

      const assignPos = (team: any[]) => {
        let available = [...REAL_POSITIONS];
        let assigned: any[] = [];

        team.forEach((p: any) => {
          // assignedPos의 타입을 명시적으로 지정하여 빌드 에러를 방지합니다.
          let assignedPos: string | null = null; 
          const preferences = [p.pos_1st, p.pos_2nd, p.pos_3rd].filter(pos => pos && pos !== '선택 안함' && pos !== '상관없음');

          for (const pref of preferences) {
            if (available.includes(pref)) { 
              assignedPos = pref; 
              break; 
            }
          }

          if (!assignedPos) {
            const safeAvailable = available.filter(pos => pos !== p.pos_exclude);
            if (safeAvailable.length > 0) {
              assignedPos = safeAvailable[Math.floor(Math.random() * safeAvailable.length)];
            } else if (available.length > 0) {
              assignedPos = available[0];
            } else {
              assignedPos = '대기';
            }
          }

          if (assignedPos !== '대기' && assignedPos !== null) {
            const finalPos = assignedPos;
            available = available.filter(v => v !== finalPos);
          }
          assigned.push({ id: p.id, pos: assignedPos });
        });
        return assigned;
      };

      const results = [...assignPos(teamA).map(res => ({...res, team: 'A팀'})), ...assignPos(teamB).map(res => ({...res, team: 'B팀'}))];
      
      for (const res of results) {
        await supabase.from('match_participants').update({ [`team_r${r}`]: res.team, [`pos_r${r}`]: res.pos }).eq('id', res.id);
      }
    }
    alert('라인업 생성 완료! 🤖🏐');
    fetchMatchDetails();
  };

  const capacityPerPos = Math.max(1, Math.round((match?.max_participants || 18) / 9));
  const positionStats = REAL_POSITIONS.map(pos => {
    const count1st = participants.filter(p => p.pos_1st === pos).length;
    const count2nd = participants.filter(p => p.pos_2nd === pos).length;
    const count3rd = participants.filter(p => p.pos_3rd === pos).length;

    let status = '여유';
    let statusClass = 'bg-green-50 text-sport-green border-green-100';

    if (count1st === 0) { status = '빈집'; statusClass = 'bg-blue-50 text-blue-500 border-blue-100'; } 
    else if (count1st >= capacityPerPos) { status = '포화'; statusClass = 'bg-red-50 text-red-500 border-red-100'; }
    return { pos, count1st, count2nd, count3rd, status, statusClass };
  });

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
                 <p className="flex items-center gap-2 font-bold"><Clock className="w-4 h-4 text-sport-blue"/> 총 {match.total_sets || 4}세트 진행 예정</p>
               </div>
            </div>

            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2">
                <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400"/> 알고리즘 라인업 생성
              </button>
            )}

            {match.recruitment_type === '알고리즘' && (
              <div>
                <h3 className="font-black text-lg mb-4 px-1 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sport-blue" /> 실시간 포지션 경쟁률
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {positionStats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-xs text-gray-700">{stat.pos}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${stat.statusClass}`}>{stat.status}</span>
                      </div>
                      <p className="text-xl font-black text-gray-900 mb-1">{stat.count1st}<span className="text-xs text-gray-400 ml-0.5">명</span></p>
                      <div className="w-full flex justify-between text-[10px] text-gray-400 font-bold px-1">
                        <span>2순위 <span className="text-gray-600">{stat.count2nd}</span></span>
                        <span>3순위 <span className="text-gray-600">{stat.count3rd}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-black text-lg mb-4 px-1">신청자 명단 ({participants.length}명)</h3>
              <div className="grid grid-cols-1 gap-3">
                {participants.map((p, idx) => {
                  const posList = [p.pos_1st, p.pos_2nd, p.pos_3rd].filter(x => x && x !== '선택 안함');
                  const shortPosText = posList.map(getShortPos).join('-');
                  const setsText = p.available_sets ? `${p.available_sets}세트 참여` : '전체 참여';

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
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold truncate">{p.profiles?.full_name}</p>
                          <p className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">{setsText}</p>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
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

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-black">{isJoined ? '신청 내용 수정' : '포지션 희망서'}</h3>
              <button onClick={() => setShowPositionModal(false)}><X className="w-8 h-8 text-gray-300"/></button>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl mb-6 text-xs font-bold text-sport-blue leading-relaxed">
              💡 2순위와 3순위(수비/속공)까지 꽉 채워주셔야 희망 배정 확률이 높아지고, 가산점(+)도 챙길 수 있습니다!
            </div>

            <button onClick={loadProfilePositions} className="w-full mb-6 py-3 border-2 border-sport-blue text-sport-blue rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50">
              <Download className="w-4 h-4" /> 내 프로필 포지션 불러오기
            </button>

            <div className="space-y-5 mb-8">
              <div className="pb-5 border-b border-gray-100">
                <label className="text-sm font-black text-gray-900 ml-1 flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-sport-blue"/> 참가 가능 세트 (다중 선택)</label>
                <div className="flex flex-wrap gap-2">
                  {/* 1~6세트까지 동적 생성 */}
                  {Array.from({length: Math.min(6, match?.total_sets || 4)}, (_, i) => String(i + 1)).map(setVal => {
                    const isSelected = joinForm.available_sets.includes(setVal);
                    return (
                      <button key={setVal} onClick={() => {
                        const curr = joinForm.available_sets;
                        if (isSelected) setJoinForm({...joinForm, available_sets: curr.filter(v => v !== setVal)});
                        else setJoinForm({...joinForm, available_sets: [...curr, setVal]});
                      }} className={`px-4 py-2.5 rounded-xl font-bold text-sm border-2 ${isSelected ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100 bg-white text-gray-400'}`}>
                        {setVal}세트
                      </button>
                    );
                  })}
                  {/* 끝장 세트(추가) 항목 */}
                  <button onClick={() => {
                    const curr = joinForm.available_sets;
                    const isSelected = curr.includes('끝장');
                    if (isSelected) setJoinForm({...joinForm, available_sets: curr.filter(v => v !== '끝장')});
                    else setJoinForm({...joinForm, available_sets: [...curr, '끝장']});
                  }} className={`px-4 py-2.5 rounded-xl font-bold text-sm border-2 ${joinForm.available_sets.includes('끝장') ? 'border-red-400 bg-red-50 text-red-500' : 'border-gray-100 bg-white text-gray-400'}`}>
                    끝장 세트(추가)
                  </button>
                </div>
              </div>

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
                    {BONUS_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="text-sm font-black text-red-400 ml-1">제외할 포지션 (선택)</label>
                <select className="w-full mt-1 p-4 rounded-2xl border-2 border-red-50 text-red-500 font-bold outline-none focus:border-red-400 bg-white"
                  value={joinForm.pos_exclude} onChange={(e) => setJoinForm({...joinForm, pos_exclude: e.target.value})}>
                  {OPTIONAL_POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
            </div>

            <button onClick={submitJoin} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-transform">
              {isJoined ? '수정 완료' : '신청 완료'}
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto z-10 bg-gradient-to-t from-gray-50 pt-10">
        {isJoined ? (
          <div className="flex gap-2">
            <button onClick={handleCancelJoin} className="flex-1 py-5 rounded-2xl font-black text-lg bg-gray-200 text-gray-600 shadow-xl active:scale-95 transition-all">참여 취소</button>
            <button onClick={openJoinModal} className="flex-[2] py-5 rounded-2xl font-black text-lg bg-sport-blue text-white shadow-xl active:scale-95 transition-all">신청 수정하기</button>
          </div>
        ) : (
          <button onClick={openJoinModal} className="w-full py-5 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-95 bg-sport-blue text-white">지금 참가 신청하기</button>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
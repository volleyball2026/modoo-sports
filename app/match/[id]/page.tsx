'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X, Download, BarChart3, Clock, Settings, Loader2, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const REAL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];
const VOLLEYBALL_POSITIONS = [...REAL_POSITIONS, "상관없음"];
const OPTIONAL_POSITIONS = ["선택 안함", ...VOLLEYBALL_POSITIONS];
const BONUS_POSITIONS = ["선택 안함", "속공", "레프트백", "센터백", "라이트백"];

// 정보 탭용 이름 마스킹 (이희성 -> 이**)
const maskName = (name: string) => {
  if (!name) return "";
  return name[0] + "*".repeat(Math.max(0, name.length - 1));
};

// 🛡️ 결정론적 랜덤 변수 생성기 (p.user_id를 활용하여 상시 고유값 유지)
const getSeedValue = (userId: string, round: number) => {
  if (!userId) return 0.5; // ID가 없을 경우 중간값
  let hash = 0;
  const str = userId + round;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
  // 0.01 ~ 0.99 사이의 값을 반환 (0이 나오지 않도록 보정)
  const seed = parseFloat((x - Math.floor(x)).toFixed(2));
  return seed === 0 ? 0.01 : seed;
};

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [match, setMatch] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [activeRound, setActiveRound] = useState(1);
  const [showAlgoGuide, setShowAlgoGuide] = useState(false); // 가이드 토글
  
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [editingParticipant, setEditingParticipant] = useState<any>(null); 
  const [joinForm, setJoinForm] = useState({
    pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함', pos_exclude: '선택 안함',
    available_sets: [] as string[] 
  });

  const sortSets = (setsArray: string[]) => {
    return [...setsArray].filter(Boolean).sort((a: string, b: string) => {
      const numA = parseInt(a); const numB = parseInt(b);
      if (isNaN(numA)) return 1; if (isNaN(numB)) return -1;
      return numA - numB;
    });
  };

  const fetchMatchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single();
      setMatch(matchData);
      const { data: partData } = await supabase.from('match_participants').select('*, profiles(*)').eq('match_id', matchId);
      setParticipants(partData || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { fetchMatchDetails(); }, [fetchMatchDetails]);

  const isJoined = participants.some((p) => p.user_id === user?.id);
  const isManager = user?.id === match?.manager_id;

  // --- 📊 가중치 실시간 계산 및 변수 노출 ---
  const getPlayerStatsForRound = (player: any, round: number) => {
    const skillMap: any = { '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 };
    const skillScore = skillMap[player.profiles?.skill_level] || 50;
    
    let penaltyCount = 0;
    let mileage = 0;

    // 이전 라운드 기록으로 가중치 계산
    for (let r = 1; r < round; r++) {
      const assigned = player[`pos_r${r}`];
      if (!assigned) continue;
      if (assigned === player.pos_1st) penaltyCount++;
      else if (assigned === '대기') mileage += 10;
      else if (assigned === player.pos_3rd) mileage += 5;
      else if (assigned === player.pos_2nd) mileage += 3;
      else mileage += 3;
    }

    // ✅ 변수(Seed) 값을 참가자 user_id 기준으로 고정 생성
    const seed = getSeedValue(player.user_id, round); 
    const baseScore = 100;
    const finalScore = (baseScore - (penaltyCount * 10) + mileage + seed).toFixed(2);
    
    return { skillScore, finalScore, penalty: penaltyCount * 10, mileage, seed };
  };

  const CourtView = ({ teamPlayers, teamType, round }: { teamPlayers: any[], teamType: string, round: number }) => {
    const isA = teamType === 'A팀';
    const bgColor = isA ? 'bg-red-50/40' : 'bg-blue-50/40';
    const borderColor = isA ? 'border-red-100' : 'border-blue-100';
    const textColor = isA ? 'text-red-500' : 'text-blue-500';

    const activePlayers = teamPlayers.filter(p => p[`pos_r${round}`] !== '대기' && p[`pos_r${round}`]);
    const avgSkill = activePlayers.length > 0 
      ? Math.round(activePlayers.reduce((acc, p) => acc + getPlayerStatsForRound(p, round).skillScore, 0) / activePlayers.length)
      : 0;

    const renderPlayer = (posName: string) => {
      const p = teamPlayers.find(player => player[`pos_r${round}`] === posName);
      if (!p) return (
        <div className="flex-1 border border-dashed border-gray-200 rounded-[24px] p-1 min-h-[100px] flex items-center justify-center opacity-30">
          <span className="text-[10px] font-black text-gray-400 uppercase">{posName}</span>
        </div>
      );

      const { finalScore, penalty, mileage, seed } = getPlayerStatsForRound(p, round);
      const prefRank = p[`pos_r${round}`] === p.pos_1st ? '1' : p[`pos_r${round}`] === p.pos_2nd ? '2' : p[`pos_r${round}`] === p.pos_3rd ? '3' : 'R';
      const rankColor = prefRank === '1' ? 'bg-blue-500' : prefRank === '2' ? 'bg-green-500' : 'bg-orange-400';

      return (
        <div className={`flex-1 bg-white border-2 ${isA ? 'border-red-200' : 'border-blue-200'} rounded-[28px] p-3 shadow-lg flex flex-col items-center justify-between min-h-[115px]`}>
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[10px] font-black text-gray-400 uppercase leading-none">{posName}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black text-white ${rankColor}`}>{prefRank}지망</span>
          </div>
          <span className="text-[14px] font-black text-gray-900 leading-tight truncate w-full text-center">{p.profiles?.full_name}</span>
          
          <div className="w-full flex flex-col items-center mt-1 border-t-2 border-gray-50 pt-2">
            {/* ✅ 최종 점수를 소수점까지 크게 표시 */}
            <span className="text-[18px] font-black text-gray-900 leading-none mb-1">{finalScore}</span>
            <div className="flex flex-wrap justify-center gap-1">
              <span className="text-[9px] font-bold text-gray-400">기본100</span>
              {penalty > 0 && <span className="text-[9px] font-black text-red-500">-{penalty}</span>}
              {mileage > 0 && <span className="text-[9px] font-black text-blue-500">+{mileage}</span>}
              {/* ✅ 변수 값을 항상 에메랄드색으로 노출 */}
              <span className="text-[9px] font-black text-emerald-500">+{seed.toFixed(2)}</span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className={`${bgColor} border-2 ${borderColor} rounded-[56px] p-8 space-y-8 shadow-inner`}>
        <div className="flex justify-between items-center px-4">
           <p className={`font-black text-xl uppercase tracking-widest ${textColor}`}>{teamType} COURT</p>
           <div className="flex flex-col items-end">
             <span className="text-[12px] font-black text-gray-400 mb-2 uppercase tracking-tighter">Avg Power: {avgSkill}</span>
             <div className="w-36 h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
               <div className={`h-full ${isA ? 'bg-red-400' : 'bg-blue-400'} transition-all duration-1000`} style={{ width: `${(avgSkill/90)*100}%` }}></div>
             </div>
           </div>
        </div>
        <div className="space-y-4">
          <div className="flex gap-3">{renderPlayer('레프트')}{renderPlayer('속공')}{renderPlayer('세터')}{renderPlayer('라이트')}</div>
          <div className="flex justify-center gap-3 px-12">{renderPlayer('앞차')}{renderPlayer('백차')}</div>
          <div className="flex gap-3">{renderPlayer('레프트백')}{renderPlayer('센터백')}{renderPlayer('라이트백')}</div>
        </div>
      </div>
    );
  };

  const positionStats = useMemo(() => {
    return REAL_POSITIONS.map(pos => {
      const count1st = participants.filter(p => p.pos_1st === pos).length;
      const count2nd = participants.filter(p => p.pos_2nd === pos).length;
      const count3rd = participants.filter(p => p.pos_3rd === pos).length;
      let status = '여유'; let statusClass = 'text-green-500 bg-green-50';
      if (count1st >= 3) { status = '혼잡'; statusClass = 'text-red-500 bg-red-50'; }
      else if (count1st === 0) { status = '빈집'; statusClass = 'text-blue-500 bg-blue-50'; }
      return { pos, count1st, count2nd, count3rd, status, statusClass };
    });
  }, [participants]);

  const openEditModal = (participant?: any) => {
    if (participant) {
      setEditingParticipant(participant);
      setJoinForm({
        pos_1st: participant.pos_1st || '레프트', pos_2nd: participant.pos_2nd || '선택 안함',
        pos_3rd: participant.pos_3rd || '선택 안함', pos_exclude: participant.pos_exclude || '선택 안함',
        available_sets: sortSets(participant.available_sets?.split(',') || [])
      });
    } else {
      setEditingParticipant(null);
      const myData = participants.find(p => p.user_id === user?.id);
      setJoinForm(myData ? {
        pos_1st: myData.pos_1st, pos_2nd: myData.pos_2nd, pos_3rd: myData.pos_3rd,
        pos_exclude: myData.pos_exclude || '선택 안함', available_sets: sortSets(myData.available_sets?.split(',') || [])
      } : {
        pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함', pos_exclude: '선택 안함',
        available_sets: ["1","2","3","4","5","6","7","8"]
      });
    }
    setShowPositionModal(true);
  };

  const submitJoin = async () => {
    if (joinForm.available_sets.length === 0) return alert('세트를 선택해주세요.');
    try {
      setIsSubmitting(true);
      const sortedSets = sortSets(joinForm.available_sets).join(',');
      const payload = {
        pos_1st: joinForm.pos_1st, pos_2nd: joinForm.pos_2nd, pos_3rd: joinForm.pos_3rd,
        pos_exclude: joinForm.pos_exclude, available_sets: sortedSets
      };
      const targetRecord = editingParticipant || participants.find(p => p.user_id === user?.id);
      if (targetRecord) {
        const { data, error } = await supabase.from('match_participants').update(payload).eq('id', targetRecord.id).select('*, profiles(*)');
        if (error) throw error;
        setParticipants(prev => prev.map(p => p.id === data[0].id ? data[0] : p));
        alert('성공적으로 저장되었습니다.');
      } else {
        const { data, error } = await supabase.from('match_participants').insert([{ ...payload, match_id: matchId, user_id: user.id }]).select('*, profiles(*)');
        if (error) throw error;
        setParticipants(prev => [...prev, data[0]]);
        alert('신청이 완료되었습니다!');
      }
      setShowPositionModal(false);
    } catch (e: any) { alert(`오류 발생: ${e.message}`); } finally { setIsSubmitting(false); }
  };

  const generateLineup = async () => {
    if (!confirm('공평 배정 알고리즘을 가동할까요?')) return;
    const history1st: Record<string, number> = {};
    const mileage: Record<string, number> = {};
    participants.forEach(p => { history1st[p.id] = 0; mileage[p.id] = 0; });
    const getSkill = (l: string) => ({ '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 }[l] || 50);

    for (let r = 1; r <= 4; r++) {
      const setA = String(r * 2 - 1); const setB = String(r * 2);
      const pool = participants.filter(p => {
        const sets = p.available_sets?.split(',') || [];
        return sets.includes(setA) || sets.includes(setB);
      }).map(p => {
        const seed = getSeedValue(p.user_id, r);
        const priorityScore = 100 - ((history1st[p.id] || 0) * 10) + (mileage[p.id] || 0) + seed;
        return { ...p, priorityScore, skillScore: getSkill(p.profiles?.skill_level) };
      });
      if (pool.length < 2) continue;
      const sortedBySkill = [...pool].sort((a, b) => b.skillScore - a.skillScore);
      const teamA: any[] = []; const teamB: any[] = [];
      sortedBySkill.forEach((p, idx) => { if (idx % 4 === 0 || idx % 4 === 3) teamA.push(p); else teamB.push(p); });

      const assign = (team: any[]) => {
        const sortedTeam = [...team].sort((a, b) => b.priorityScore - a.priorityScore);
        let remainingPos = [...REAL_POSITIONS]; const results: any[] = [];
        sortedTeam.forEach(p => {
          let finalPos = "대기"; let type = "wait";
          const wishes = [{ p: p.pos_1st, t: "1st" }, { p: p.pos_2nd, t: "2nd" }, { p: p.pos_3rd, t: "3rd" }].filter(w => w.p && w.p !== "선택 안함");
          for (const w of wishes) { if (remainingPos.includes(w.p)) { finalPos = w.p; type = w.t; break; } }
          if (finalPos === "대기" && remainingPos.length > 0) {
            const safe = remainingPos.filter(pos => pos !== p.pos_exclude);
            finalPos = safe.length > 0 ? safe[Math.floor(Math.random() * safe.length)] : remainingPos[0];
            type = "random";
          }
          if (finalPos !== "대기") remainingPos = remainingPos.filter(v => v !== finalPos);
          if (type === "1st") history1st[p.id]++;
          else if (type === "2nd") mileage[p.id] += 3;
          else if (type === "3rd") mileage[p.id] += 5;
          else mileage[p.id] += 10;
          results.push({ id: p.id, pos: finalPos });
        });
        return results;
      };

      const finalData = [...assign(teamA).map(res => ({ ...res, team: 'A팀' })), ...assign(teamB).map(res => ({ ...res, team: 'B팀' }))];
      for (const res of finalData) { await supabase.from('match_participants').update({ [`team_r${r}`]: res.team, [`pos_r${r}`]: res.pos }).eq('id', res.id); }
    }
    alert('라인업 생성이 완료되었습니다! 🤖'); fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center font-bold">데이터 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-44">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto justify-between items-center font-bold shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}><ArrowLeft /></button>
          <h1 className="text-lg">매치 상세</h1>
        </div>
        {isManager && (
          <div className="flex gap-4">
            <button onClick={() => supabase.from('matches').update({ is_lineup_visible: !match.is_lineup_visible }).eq('id', matchId).then(() => fetchMatchDetails())}>
              {match.is_lineup_visible ? <EyeOff /> : <Eye className="text-sport-blue"/>}
            </button>
            <button onClick={() => router.push(`/match/${matchId}/edit`)}><Edit3 /></button>
            <button onClick={() => { if(confirm('매치를 삭제하시겠습니까?')) supabase.from('matches').delete().eq('id', matchId).then(() => router.push('/')) }}><Trash2 className="text-red-500" /></button>
          </div>
        )}
      </header>

      <div className="bg-white border-b sticky top-14 z-20">
        <div className="flex max-w-lg mx-auto">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 font-black text-sm ${activeTab === 'info' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>정보/명단</button>
          <button onClick={() => setActiveTab('lineup')} className={`flex-1 py-4 font-black text-sm ${activeTab === 'lineup' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>코트 라인업</button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-10">
        {activeTab === 'info' ? (
          <>
            <div className="bg-white p-6 rounded-[40px] shadow-sm border font-bold">
               <h2 className="text-2xl font-black mb-4 leading-tight">{match.title}</h2>
               <div className="space-y-1.5 text-sm text-gray-500">
                 <p className="flex items-center gap-2 font-black"><Calendar className="w-4 h-4 text-sport-blue"/> {match.match_date}</p>
                 <p className="flex items-center gap-2 font-black"><MapPin className="w-4 h-4 text-sport-blue"/> {match.location}</p>
                 <p className="flex items-center gap-2 font-black"><Users className="w-4 h-4 text-sport-blue"/> {participants.length}명 신청 완료</p>
               </div>
            </div>

            <section className="space-y-4">
              <h3 className="font-black text-lg px-2 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-sport-blue" /> 실시간 포지션 경쟁률</h3>
              <div className="grid grid-cols-3 gap-2">
                {positionStats.map((stat, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-[24px] border shadow-sm flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1 mb-2">
                      <span className="font-bold text-[11px] text-gray-700">{stat.pos}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${stat.statusClass}`}>{stat.status}</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 mb-1">{stat.count1st}<span className="text-xs text-gray-400 ml-0.5 font-bold">명</span></p>
                    <div className="w-full flex justify-between text-[9px] text-gray-400 font-bold px-1.5">
                      <span>2지망 <span className="text-gray-600">{stat.count2nd}</span></span>
                      <span>3지망 <span className="text-gray-600">{stat.count3rd}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Zap className="text-yellow-400 fill-yellow-400 w-5 h-5"/> 알고리즘 라인업 생성
              </button>
            )}

            <div className="space-y-3">
              <h3 className="font-black text-lg px-2">신청자 명단 ({participants.length}명)</h3>
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white p-4 rounded-[28px] border shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center font-bold text-sport-blue overflow-hidden border">
                    {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 font-black">
                    <p className="text-base text-gray-900">{maskName(p.profiles?.full_name)}</p>
                    <p className="text-[10px] text-gray-400 font-bold">{sortSets(p.available_sets?.split(',') || []).join(', ')}세트</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-black text-sport-blue bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">{p.pos_1st}</div>
                    {isManager && <button onClick={() => openEditModal(p)} className="p-2.5 bg-gray-50 rounded-xl text-gray-400"><Settings className="w-4 h-4"/></button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* 📘 알고리즘 배정방식 가이드 */}
            <div className="bg-white border-2 border-sport-blue/20 rounded-[32px] overflow-hidden shadow-sm">
              <button onClick={() => setShowAlgoGuide(!showAlgoGuide)} className="w-full p-5 flex items-center justify-between bg-blue-50/30 hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-sport-blue rounded-full flex items-center justify-center"><Info className="w-5 h-5 text-white" /></div>
                  <span className="font-black text-gray-800 text-sm">여순광 공평 배정 알고리즘 원리</span>
                </div>
                {showAlgoGuide ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
              </button>
              {showAlgoGuide && (
                <div className="p-6 bg-white space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-red-500 uppercase">점수 감점 (-)</p>
                      <p className="text-[13px] font-bold text-gray-600 leading-relaxed">이전 라운드 <span className="text-gray-900">1순위 포지션</span> 배정 시마다 <span className="text-red-500">-10점</span>이 누적됩니다.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-blue-500 uppercase">점수 가점 (+)</p>
                      <p className="text-[13px] font-bold text-gray-600 leading-relaxed">대기(<span className="text-blue-500">+10</span>), 3순위(<span className="text-blue-500">+5</span>), 2순위(<span className="text-blue-500">+3</span>) 수행 시 마일리지가 쌓입니다.</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-50">
                    <p className="text-[11px] font-black text-emerald-500 uppercase mb-2">변수(Seed) 생성 원리</p>
                    <p className="text-[13px] font-bold text-gray-600 leading-relaxed">모든 참가자의 점수가 같을 경우를 대비해, <span className="text-gray-900">고유ID와 라운드 번호</span>를 조합한 소수점 랜덤값(0~1)이 매 라운드 새롭게 부여됩니다.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-1">
              {[1, 2, 3, 4].map(r => (
                <button key={r} onClick={() => setActiveRound(r)} className={`px-7 py-3.5 rounded-full font-black text-sm whitespace-nowrap transition-all border-2 ${activeRound === r ? 'bg-sport-blue border-sport-blue text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400'}`}>
                  {r*2-1}·{r*2} SET
                </button>
              ))}
            </div>

            { (match.is_lineup_visible || isManager || isJoined) ? (
              <div className="space-y-10 pb-20 px-1">
                <CourtView teamPlayers={participants.filter(p => p[`team_r${activeRound}`] === 'A팀')} teamType="A팀" round={activeRound} />
                <div className="flex items-center justify-center py-2">
                  <div className="h-[3px] bg-gray-200 flex-1 rounded-full"></div>
                  <span className="px-8 text-[11px] font-black text-gray-300 uppercase tracking-widest">Net Center</span>
                  <div className="h-[3px] bg-gray-200 flex-1 rounded-full"></div>
                </div>
                <CourtView teamPlayers={participants.filter(p => p[`team_r${activeRound}`] === 'B팀')} teamType="B팀" round={activeRound} />

                { participants.some(p => p[`pos_r${activeRound}`] === '대기') && (
                  <div className="bg-white p-8 rounded-[48px] border-2 border-dashed border-gray-200 shadow-sm">
                    <p className="text-[12px] font-black text-gray-400 mb-5 flex items-center gap-2 uppercase tracking-wide"><Clock className="w-5 h-5"/> 대기 선수 명단 (보상 +10)</p>
                    <div className="grid grid-cols-2 gap-4">
                      {participants.filter(p => p[`pos_r${activeRound}`] === '대기').map(p => (
                        <div key={p.id} className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
                          <p className="text-[14px] font-black text-gray-800">{p.profiles?.full_name}</p>
                          <p className="text-[10px] font-black text-gray-400 mt-1 uppercase tracking-tight">1ST WISH: {p.pos_1st}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="py-24 text-center font-black text-gray-300">라인업이 비공개 상태입니다. 🕵️‍♂️<br/><span className="text-xs font-bold text-gray-400 mt-2 block">참가 신청자만 조회가 가능합니다.</span></div>}
          </div>
        )}
      </main>

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[48px] p-10 max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-2xl font-black mb-8">{editingParticipant ? `${editingParticipant.profiles?.full_name}님 정보 수정` : '매치 참가 신청'}</h3>
            <div className="space-y-8">
              <div>
                <label className="text-sm font-black mb-4 block text-gray-600">참여 가능한 세트</label>
                <div className="grid grid-cols-4 gap-2">
                  {["1","2","3","4","5","6","7","8"].map(s => (
                    <button key={s} onClick={() => {
                      const curr = joinForm.available_sets;
                      setJoinForm({...joinForm, available_sets: curr.includes(s) ? curr.filter(v => v !== s) : [...curr, s]});
                    }} className={`py-4 rounded-[20px] font-black text-sm border-2 transition-all ${joinForm.available_sets.includes(s) ? 'border-sport-blue bg-blue-50 text-sport-blue shadow-md' : 'border-gray-100 text-gray-400'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 pt-2">
                <select className="w-full p-5 rounded-[24px] border-2 font-black text-gray-700 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none transition-all" value={joinForm.pos_1st} onChange={e => setJoinForm({...joinForm, pos_1st: e.target.value})}>
                  {VOLLEYBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <select className="w-full p-5 rounded-[24px] border-2 font-black text-gray-700 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none transition-all" value={joinForm.pos_2nd} onChange={e => setJoinForm({...joinForm, pos_2nd: e.target.value})}>
                    {OPTIONAL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select className="w-full p-5 rounded-[24px] border-2 font-black text-gray-700 bg-gray-50 focus:bg-white focus:border-sport-blue outline-none transition-all" value={joinForm.pos_3rd} onChange={e => setJoinForm({...joinForm, pos_3rd: e.target.value})}>
                    {BONUS_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={submitJoin} disabled={isSubmitting} className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black text-xl shadow-2xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : '설정 저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto bg-gradient-to-t from-gray-50 via-gray-50 pt-10 z-10">
        <button onClick={() => openEditModal()} className="w-full py-5 rounded-[32px] font-black text-lg bg-sport-blue text-white shadow-2xl active:scale-95 transition-all">
          {isJoined ? '나의 신청 내역 수정하기' : '지금 참가 신청하기 🏐'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
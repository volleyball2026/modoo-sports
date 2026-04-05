'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  Zap, Eye, EyeOff, X, ClipboardList, Clock, Settings, Loader2, Info, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, BarChart3, User
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const REAL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];
const VOLLEYBALL_POSITIONS = [...REAL_POSITIONS, "상관없음"];
const OPTIONAL_POSITIONS = ["선택 안함", ...VOLLEYBALL_POSITIONS];
const BONUS_POSITIONS = ["선택 안함", "속공", "레프트백", "센터백", "라이트백"];
const LEVELS = ["입문", "초급", "중급", "상급", "최상급"];

const maskName = (name: string) => {
  if (!name) return "";
  return name[0] + "*".repeat(Math.max(0, name.length - 1));
};

const getSeedValue = (userId: string, round: number) => {
  if (!userId) return 0.5;
  let hash = 0;
  const str = userId + round;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash) * 10000;
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
  const [showAlgoGuide, setShowAlgoGuide] = useState(false);
  
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [editingParticipant, setEditingParticipant] = useState<any>(null); 
  const [joinForm, setJoinForm] = useState({
    skill_level: '초급',
    pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함',
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
  const isPositionRecruit = match?.recruitment_type === 'position';

  // --- 📊 모집 방식에 따른 현황 계산 ---
  const positionTOStats = useMemo(() => {
    if (!isPositionRecruit || !match?.position_settings) return [];
    return Object.entries(match.position_settings)
      .filter(([_, to]: [any, any]) => to > 0)
      .map(([pos, to]: [any, any]) => {
        const currentCount = participants.filter(p => p.pos_1st === pos).length;
        const remaining = to - currentCount;
        return { pos, currentCount, to, remaining, isFull: remaining <= 0 };
      });
  }, [match, participants, isPositionRecruit]);

  const algoStats = useMemo(() => {
    if (isPositionRecruit) return [];
    return REAL_POSITIONS.map(pos => {
      const count1st = participants.filter(p => p.pos_1st === pos).length;
      let status = count1st >= 3 ? '혼잡' : (count1st === 0 ? '빈집' : '여유');
      let statusClass = count1st >= 3 ? 'text-red-500 bg-red-50' : (count1st === 0 ? 'text-blue-500 bg-blue-50' : 'text-green-500 bg-green-50');
      return { pos, count1st, status, statusClass };
    });
  }, [participants, isPositionRecruit]);

  // --- 🏐 코트 뷰 로직 (기존 점수 계산 포함) ---
  const getPlayerStatsForRound = (player: any, round: number) => {
    const skillMap: any = { '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 };
    const skillScore = skillMap[player.profiles?.skill_level] || 50;
    let penaltyCount = 0, mileage = 0;
    for (let r = 1; r < round; r++) {
      const assigned = player[`pos_r${r}`];
      if (!assigned) continue;
      if (assigned === player.pos_1st) penaltyCount++;
      else if (assigned === '대기') mileage += 10;
      else if (assigned === player.pos_3rd) mileage += 5;
      else if (assigned === player.pos_2nd) mileage += 3;
      else mileage += 3;
    }
    const seed = getSeedValue(player.user_id, round); 
    const finalScore = (100 - (penaltyCount * 10) + mileage + seed).toFixed(2);
    return { skillScore, finalScore, penalty: penaltyCount * 10, mileage, seed };
  };

  const CourtView = ({ teamPlayers, teamType, round }: { teamPlayers: any[], teamType: string, round: number }) => {
    const isA = teamType === 'A팀';
    const activePlayers = teamPlayers.filter(p => p[`pos_r${round}`] !== '대기' && p[`pos_r${round}`]);
    const avgSkill = activePlayers.length > 0 
      ? Math.round(activePlayers.reduce((acc, p) => acc + getPlayerStatsForRound(p, round).skillScore, 0) / activePlayers.length)
      : 0;

    const renderPlayer = (posName: string) => {
      const p = teamPlayers.find(player => player[`pos_r${round}`] === posName);
      if (!p) return <div className="flex-1 border border-dashed border-gray-200 rounded-[20px] p-1 min-h-[90px] flex items-center justify-center opacity-30"><span className="text-[9px] font-black text-gray-400 uppercase">{posName}</span></div>;
      const { finalScore, penalty, mileage, seed } = getPlayerStatsForRound(p, round);
      const prefRank = p[`pos_r${round}`] === p.pos_1st ? '1' : p[`pos_r${round}`] === p.pos_2nd ? '2' : p[`pos_r${round}`] === p.pos_3rd ? '3' : 'R';
      const rankColor = prefRank === '1' ? 'bg-blue-500' : prefRank === '2' ? 'bg-green-500' : 'bg-orange-400';

      return (
        <div className={`flex-1 bg-white border-2 ${isA ? 'border-red-200' : 'border-blue-200'} rounded-[24px] p-2.5 shadow-lg flex flex-col items-center justify-between min-h-[110px]`}>
          <div className="flex items-center justify-between w-full mb-1">
            <span className="text-[9px] font-black text-gray-400 uppercase">{posName}</span>
            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black text-white ${rankColor}`}>{isPositionRecruit ? '확정' : prefRank+'지망'}</span>
          </div>
          <span className="text-[13px] font-black text-gray-900 leading-tight truncate w-full text-center">{p.profiles?.full_name}</span>
          <div className="w-full flex flex-col items-center mt-1 border-t-2 border-gray-50 pt-1.5">
            <span className="text-[16px] font-black text-gray-900">{finalScore}</span>
            <div className="flex flex-wrap justify-center gap-1">
              {penalty > 0 && <span className="text-[8px] font-black text-red-500">-{penalty}</span>}
              {mileage > 0 && <span className="text-[8px] font-black text-blue-500">+{mileage}</span>}
              <span className="text-[8px] font-black text-emerald-500">+{seed.toFixed(2)}</span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className={`${isA ? 'bg-red-50/40 border-red-100' : 'bg-blue-50/40 border-blue-100'} border-2 rounded-[48px] p-7 space-y-7 shadow-inner`}>
        <div className="flex justify-between items-center px-2">
           <p className={`font-black text-base uppercase tracking-widest ${isA ? 'text-red-500' : 'text-blue-500'}`}>{teamType} COURT</p>
           <div className="text-right">
             <span className="text-[10px] font-black text-gray-400">POWER: {avgSkill}</span>
             <div className="w-24 h-2 bg-gray-100 rounded-full mt-1"><div className={`h-full ${isA ? 'bg-red-400' : 'bg-blue-400'}`} style={{ width: `${(avgSkill/90)*100}%` }}></div></div>
           </div>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2.5">{renderPlayer('레프트')}{renderPlayer('속공')}{renderPlayer('세터')}{renderPlayer('라이트')}</div>
          <div className="flex justify-center gap-2.5 px-10">{renderPlayer('앞차')}{renderPlayer('백차')}</div>
          <div className="flex gap-2.5">{renderPlayer('레프트백')}{renderPlayer('센터백')}{renderPlayer('라이트백')}</div>
        </div>
      </div>
    );
  };

  // --- 🛠️ 수정 및 참가 로직 (동적 필드 반영) ---
  const openEditModal = (participant?: any) => {
    if (participant) {
      setEditingParticipant(participant);
      setJoinForm({
        skill_level: participant.profiles?.skill_level || '초급',
        pos_1st: participant.pos_1st, pos_2nd: participant.pos_2nd || '선택 안함', pos_3rd: participant.pos_3rd || '선택 안함',
        available_sets: sortSets(participant.available_sets?.split(',') || [])
      });
    } else {
      setEditingParticipant(null);
      const my = participants.find(p => p.user_id === user?.id);
      setJoinForm(my ? {
        skill_level: my.profiles?.skill_level || '초급',
        pos_1st: my.pos_1st, pos_2nd: my.pos_2nd || '선택 안함', pos_3rd: my.pos_3rd || '선택 안함',
        available_sets: sortSets(my.available_sets?.split(',') || [])
      } : {
        skill_level: '초급', pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함',
        available_sets: ["1","2","3","4","5","6","7","8"]
      });
    }
    setShowPositionModal(true);
  };

  const submitJoin = async () => {
    if (!joinForm.pos_1st) return alert('포지션을 선택해주세요.');
    if (joinForm.available_sets.length === 0) return alert('세트를 선택해주세요.');
    try {
      setIsSubmitting(true);
      const targetUserId = editingParticipant ? editingParticipant.user_id : user?.id;
      const targetRecord = editingParticipant || participants.find(p => p.user_id === user?.id);
      
      await supabase.from('profiles').update({ skill_level: joinForm.skill_level }).eq('id', targetUserId);
      
      const payload = {
        pos_1st: joinForm.pos_1st, pos_2nd: isPositionRecruit ? '선택 안함' : joinForm.pos_2nd,
        pos_3rd: isPositionRecruit ? '선택 안함' : joinForm.pos_3rd,
        available_sets: sortSets(joinForm.available_sets).join(',')
      };

      if (targetRecord) {
        const { data, error } = await supabase.from('match_participants').update(payload).eq('id', targetRecord.id).select('*, profiles(*)');
        if (error) throw error;
        setParticipants(prev => prev.map(p => p.id === data[0].id ? data[0] : p));
        alert('정보가 수정되었습니다.');
      } else {
        const { data, error } = await supabase.from('match_participants').insert([{ ...payload, match_id: matchId, user_id: user.id }]).select('*, profiles(*)');
        if (error) throw error;
        setParticipants(prev => [...prev, data[0]]);
        alert('참가 신청이 완료되었습니다!');
      }
      setShowPositionModal(false);
    } catch (e: any) { alert(`오류: ${e.message}`); } finally { setIsSubmitting(false); }
  };

  const cancelJoin = async () => {
    const targetRecord = editingParticipant || participants.find(p => p.user_id === user?.id);
    if (!targetRecord || !confirm('참가를 취소하시겠습니까?')) return;
    try {
      setIsSubmitting(true);
      await supabase.from('match_participants').delete().eq('id', targetRecord.id);
      setParticipants(prev => prev.filter(p => p.id !== targetRecord.id));
      alert('취소되었습니다.'); setShowPositionModal(false);
    } catch (e: any) { alert(e.message); } finally { setIsSubmitting(false); }
  };

  // --- 🤖 알고리즘 가동 (메인 기능 보존) ---
  const generateLineup = async () => {
    if (!confirm('알고리즘을 가동할까요?')) return;
    const history1st: Record<string, number> = {}, mileage: Record<string, number> = {};
    participants.forEach(p => { history1st[p.user_id] = 0; mileage[p.user_id] = 0; });
    const getSkill = (l: string) => ({ '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 }[l] || 50);

    for (let r = 1; r <= 4; r++) {
      const setA = String(r * 2 - 1), setB = String(r * 2);
      const pool = participants.filter(p => (p.available_sets?.split(',') || []).some((s:string) => s === setA || s === setB)).map(p => {
        const seed = getSeedValue(p.user_id, r);
        return { ...p, priorityScore: 100 - ((history1st[p.user_id] || 0) * 10) + (mileage[p.user_id] || 0) + seed, skillScore: getSkill(p.profiles?.skill_level) };
      });
      if (pool.length < 2) continue;
      const sorted = [...pool].sort((a, b) => b.skillScore - a.skillScore);
      const teamA: any[] = [], teamB: any[] = [];
      sorted.forEach((p, idx) => { if (idx % 4 === 0 || idx % 4 === 3) teamA.push(p); else teamB.push(p); });

      const assign = (team: any[]) => {
        const sortedTeam = [...team].sort((a, b) => b.priorityScore - a.priorityScore);
        let remainPos = [...REAL_POSITIONS]; const res: any[] = [];
        sortedTeam.forEach(p => {
          let finalPos = "대기", type = "wait";
          const wishes = [{ p: p.pos_1st, t: "1st" }, { p: p.pos_2nd, t: "2nd" }, { p: p.pos_3rd, t: "3rd" }].filter(w => w.p && w.p !== "선택 안함");
          for (const w of wishes) { if (remainPos.includes(w.p)) { finalPos = w.p; type = w.t; break; } }
          if (finalPos === "대기" && remainPos.length > 0) {
            const safe = remainPos.filter(pos => pos !== p.pos_exclude);
            finalPos = safe.length > 0 ? safe[Math.floor(Math.random() * safe.length)] : remainPos[0];
            type = "random";
          }
          if (finalPos !== "대기") remainPos = remainPos.filter(v => v !== finalPos);
          if (type === "1st") history1st[p.user_id]++;
          else if (type === "2nd") mileage[p.user_id] += 3;
          else if (type === "3rd") mileage[p.user_id] += 5;
          else mileage[p.user_id] += 10;
          res.push({ id: p.id, pos: finalPos });
        });
        return res;
      };
      const finalRound = [...assign(teamA).map(r => ({ ...r, team: 'A팀' })), ...assign(teamB).map(r => ({ ...r, team: 'B팀' }))];
      for (const fr of finalRound) { await supabase.from('match_participants').update({ [`team_r${r}`]: fr.team, [`pos_r${r}`]: fr.pos }).eq('id', fr.id); }
    }
    alert('라인업 생성이 완료되었습니다!'); fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-44">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto justify-between items-center font-bold shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}><ArrowLeft className="w-5 h-5"/></button>
          <h1 className="text-lg font-black truncate max-w-[220px]">
            {match.sport === '배구' ? '🏐 ' : '🏆 '}{match.title}
          </h1>
        </div>
        {isManager && (
          <div className="flex gap-4">
            <button onClick={() => supabase.from('matches').update({ is_lineup_visible: !match.is_lineup_visible }).eq('id', matchId).then(() => fetchMatchDetails())}>
              {match.is_lineup_visible ? <EyeOff className="text-gray-400"/> : <Eye className="text-sport-blue"/>}
            </button>
            <button onClick={() => router.push(`/match/${matchId}/edit`)}><Edit3 className="text-gray-400"/></button>
            <button onClick={() => { if(confirm('삭제?')) supabase.from('matches').delete().eq('id', matchId).then(() => router.push('/')) }}><Trash2 className="text-red-500" /></button>
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
            <div className="bg-white p-6 rounded-[40px] shadow-sm border font-bold space-y-3">
               <div className="space-y-1.5 text-sm text-gray-500">
                 <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-sport-blue"/> {match.match_date}</p>
                 <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-sport-blue"/> {match.location}</p>
                 <p className="flex items-center gap-2"><Users className="w-4 h-4 text-sport-blue"/> {participants.length}/{match.max_participants}명 신청 중</p>
               </div>
               {isPositionRecruit && <p className="text-[11px] font-bold text-sport-blue bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">📢 포지션별 선착순 모집 중입니다.</p>}
            </div>

            {/* ✅ 포지션 지정용 T.O 현황 vs 알고리즘용 경쟁률 */}
            <section className="space-y-4">
              <h3 className="font-black text-lg px-2 flex items-center gap-2">
                {isPositionRecruit ? <ClipboardList className="w-5 h-5 text-sport-blue"/> : <BarChart3 className="w-5 h-5 text-sport-blue"/>}
                {isPositionRecruit ? '포지션별 남은 자리 (T.O)' : '실시간 포지션 경쟁률'}
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {(isPositionRecruit ? positionTOStats : algoStats).map((stat: any, idx) => (
                  <div key={idx} className={`p-4 rounded-[20px] border shadow-sm flex items-center justify-between bg-white border-gray-100 ${stat.isFull ? 'opacity-50' : ''}`}>
                    <span className="font-black text-sm text-gray-900">{stat.pos}</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isPositionRecruit ? (stat.isFull ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-sport-blue') : stat.statusClass}`}>
                      {isPositionRecruit ? (stat.isFull ? '마감' : `${stat.remaining}자리 남음`) : stat.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {isManager && !isPositionRecruit && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><Zap className="text-yellow-400 fill-yellow-400 w-5 h-5"/> 알고리즘 가동하기</button>
            )}

            <div className="space-y-3">
              <h3 className="font-black text-lg px-2">참가자 명단 ({participants.length}명)</h3>
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white p-4 rounded-[28px] border shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center font-bold text-sport-blue overflow-hidden border shrink-0">
                    {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 font-black">
                    <p className="text-base text-gray-900">{maskName(p.profiles?.full_name)}</p>
                    <p className="text-[10px] text-gray-400 font-bold truncate">{sortSets(p.available_sets?.split(',') || []).join(', ')}세트</p>
                    <div className="flex gap-1 mt-1">
                      <span className="text-[8px] bg-blue-50 text-sport-blue px-1.5 py-0.5 rounded border border-blue-100">{p.pos_1st}</span>
                      {!isPositionRecruit && p.pos_2nd !== '선택 안함' && <span className="text-[8px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">{p.pos_2nd}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{p.profiles?.skill_level}</div>
                    {(isManager || p.user_id === user?.id) && <button onClick={() => openEditModal(p)} className="p-2.5 bg-gray-50 rounded-xl text-gray-400 hover:text-sport-blue"><Settings className="w-4 h-4"/></button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border-2 border-sport-blue/20 rounded-[32px] overflow-hidden shadow-sm">
              <button onClick={() => setShowAlgoGuide(!showAlgoGuide)} className="w-full p-5 flex items-center justify-between bg-blue-50/30">
                <div className="flex items-center gap-3"><div className="w-8 h-8 bg-sport-blue rounded-full flex items-center justify-center"><Info className="w-5 h-5 text-white" /></div><span className="font-black text-gray-800 text-sm">공평 배정 알고리즘 원리</span></div>
                {showAlgoGuide ? <ChevronUp className="text-gray-400"/> : <ChevronDown className="text-gray-400"/>}
              </button>
              {showAlgoGuide && (
                <div className="p-6 bg-white space-y-4 text-[13px] font-bold text-gray-600">
                  <p>📉 <span className="text-red-500">감점:</span> 1순위 배정 시마다 <span className="text-gray-900">-10점</span></p>
                  <p>📈 <span className="text-blue-500">가점:</span> 대기(+10), 3순위(+5), 2순위(+3)</p>
                  <p>🎲 <span className="text-emerald-500">변수:</span> 동점자 방지를 위한 매 세트 소수점 랜덤값</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-4 px-1">
              {[1, 2, 3, 4].map(r => (
                <button key={r} onClick={() => setActiveRound(r)} className={`px-7 py-3.5 rounded-full font-black text-sm whitespace-nowrap transition-all border-2 ${activeRound === r ? 'bg-sport-blue border-sport-blue text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400'}`}>
                  {r*2-1}·{r*2} SET
                </button>
              ))}
            </div>

            { (match.is_lineup_visible || isManager || isJoined) ? (
              <div className="space-y-10 pb-20 px-1">
                <CourtView teamPlayers={participants.filter(p => p[`team_r${activeRound}`] === 'A팀')} teamType="A팀" round={activeRound} />
                <div className="flex items-center justify-center py-2"><div className="h-[3px] bg-gray-200 flex-1 rounded-full"></div><span className="px-8 text-[11px] font-black text-gray-300 uppercase tracking-widest">Net Area</span><div className="h-[3px] bg-gray-200 flex-1 rounded-full"></div></div>
                <CourtView teamPlayers={participants.filter(p => p[`team_r${activeRound}`] === 'B팀')} teamType="B팀" round={activeRound} />
                { participants.some(p => p[`pos_r${activeRound}`] === '대기') && (
                  <div className="bg-white p-8 rounded-[48px] border-2 border-dashed border-gray-200 shadow-sm">
                    <p className="text-[12px] font-black text-gray-400 mb-5 uppercase"><Clock className="w-5 h-5 inline mr-2"/> 대기 선수 명단</p>
                    <div className="grid grid-cols-2 gap-4">
                      {participants.filter(p => p[`pos_r${activeRound}`] === '대기').map(p => (
                        <div key={p.id} className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100"><p className="text-[14px] font-black text-gray-800">{p.profiles?.full_name}</p></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="py-24 text-center font-black text-gray-300">라인업 비공개 상태입니다. 🕵️‍♂️</div>}
          </div>
        )}
      </main>

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[48px] p-10 max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-2xl font-black text-gray-900 mb-8">{editingParticipant ? '정보 수정' : (isJoined ? '신청 수정' : '참가 신청')}</h3>
            <div className="space-y-8">
              <div><label className="text-sm font-black mb-4 block text-gray-600">나의 실력</label>
                <select className="w-full p-5 rounded-[24px] border-2 font-black bg-blue-50 border-blue-100" value={joinForm.skill_level} onChange={e => setJoinForm({...joinForm, skill_level: e.target.value})}>{LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
              </div>
              <div><label className="text-sm font-black mb-4 block text-gray-600">참여 세트</label>
                <div className="grid grid-cols-4 gap-2">{["1","2","3","4","5","6","7","8"].map(s => (
                  <button key={s} onClick={() => { const curr = joinForm.available_sets; setJoinForm({...joinForm, available_sets: curr.includes(s) ? curr.filter(v => v !== s) : [...curr, s]}); }} className={`py-4 rounded-[20px] font-black text-sm border-2 ${joinForm.available_sets.includes(s) ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100 text-gray-400'}`}>{s}</button>
                ))}</div>
              </div>
              
              {/* ✅ 포지션 모집일 때와 알고리즘용 폼 분기 */}
              {isPositionRecruit ? (
                <div><label className="text-sm font-black mb-4 block text-gray-600">확정 포지션 선택 (선착순)</label>
                  <div className="grid grid-cols-2 gap-2.5">{positionTOStats.map((stat: any, idx) => (
                    <button key={idx} type="button" disabled={stat.isFull && joinForm.pos_1st !== stat.pos} onClick={() => setJoinForm({...joinForm, pos_1st: stat.pos})}
                      className={`p-4 rounded-[20px] border-2 flex flex-col items-center gap-1 ${joinForm.pos_1st === stat.pos ? 'border-sport-blue bg-blue-50 text-sport-blue' : (stat.isFull ? 'bg-gray-50 text-gray-300' : 'bg-white text-gray-600')}`}>
                      <span className="font-black text-sm">{stat.pos}</span><span className="text-[10px]">{stat.isFull ? '마감' : stat.remaining+'자리'}</span>
                    </button>
                  ))}</div>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <label className="text-sm font-black block text-gray-600">희망 포지션 (1/2/3순위)</label>
                  <select className="w-full p-5 rounded-[24px] border-2 font-black" value={joinForm.pos_1st} onChange={e => setJoinForm({...joinForm, pos_1st: e.target.value})}>{VOLLEYBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                  <div className="grid grid-cols-2 gap-3">
                    <select className="w-full p-5 rounded-[24px] border-2 font-black" value={joinForm.pos_2nd} onChange={e => setJoinForm({...joinForm, pos_2nd: e.target.value})}>{OPTIONAL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                    <select className="w-full p-5 rounded-[24px] border-2 font-black" value={joinForm.pos_3rd} onChange={e => setJoinForm({...joinForm, pos_3rd: e.target.value})}>{BONUS_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-4">
                <button onClick={submitJoin} disabled={isSubmitting} className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black text-xl shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (editingParticipant || isJoined ? '수정 내용 저장하기' : '참가 신청 완료하기')}
                </button>
                {(isJoined || editingParticipant) && <button onClick={cancelJoin} disabled={isSubmitting} className="w-full py-4 text-red-500 font-black text-base flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> 매치 참가 취소하기</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto bg-gradient-to-t from-gray-50 via-gray-50 pt-10 z-10">
        <button onClick={() => openEditModal()} className="w-full py-5 rounded-[32px] font-black text-lg bg-sport-blue text-white shadow-2xl active:scale-95 transition-all">{isJoined ? '나의 신청 정보 수정/취소' : '지금 참가 신청하기 🏐'}</button>
      </div>
      <BottomNav />
    </div>
  );
}
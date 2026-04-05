'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X, Download, BarChart3, Clock, Settings, Loader2, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const REAL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];
const VOLLEYBALL_POSITIONS = [...REAL_POSITIONS, "상관없음"];
const OPTIONAL_POSITIONS = ["선택 안함", ...VOLLEYBALL_POSITIONS];
const BONUS_POSITIONS = ["선택 안함", "속공", "레프트백", "센터백", "라이트백"];

const anonymizeName = (name: string) => {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "O";
  return name[0] + "O" + name.slice(2);
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
  
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [editingParticipant, setEditingParticipant] = useState<any>(null); 
  const [joinForm, setJoinForm] = useState({
    pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함', pos_exclude: '선택 안함',
    available_sets: [] as string[] 
  });

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

  // ✅ [수정 포인트] 에러가 났던 isManager 변수를 컴포넌트 최상단에 선언했습니다.
  const isJoined = participants.some((p) => p.user_id === user?.id);
  const isManager = user?.id === match?.manager_id;

  const getPlayerStatsForRound = (player: any, round: number) => {
    const skillMap: any = { '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 };
    const skillScore = skillMap[player.profiles?.skill_level] || 50;
    let penaltyCount = 0;
    let mileage = 0;

    for (let r = 1; r < round; r++) {
      const assigned = player[`pos_r${r}`];
      if (!assigned) continue;
      if (assigned === player.pos_1st) penaltyCount++;
      else if (assigned === '대기') mileage += 10;
      else if (assigned === player.pos_3rd) mileage += 5;
      else if (assigned === player.pos_2nd) mileage += 3;
      else mileage += 3;
    }

    const priorityScore = 100 - (penaltyCount * 10) + mileage;
    const weightText = `기본(100) ${penaltyCount > 0 ? `-${penaltyCount*10}` : ''} ${mileage > 0 ? `+${mileage}` : ''}`;
    return { skillScore, priorityScore, weightText };
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
        <div className="flex-1 border border-dashed border-gray-200 rounded-xl p-1 min-h-[70px] flex flex-col items-center justify-center opacity-30">
          <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">{posName}</span>
        </div>
      );

      const { priorityScore, weightText } = getPlayerStatsForRound(p, round);
      const prefRank = p[`pos_r${round}`] === p.pos_1st ? '1' : p[`pos_r${round}`] === p.pos_2nd ? '2' : p[`pos_r${round}`] === p.pos_3rd ? '3' : 'R';
      const rankColor = prefRank === '1' ? 'bg-blue-500' : prefRank === '2' ? 'bg-green-500' : 'bg-orange-400';

      return (
        <div className={`flex-1 bg-white border ${isA ? 'border-red-200' : 'border-blue-200'} rounded-xl p-1.5 shadow-sm flex flex-col items-center justify-center min-h-[70px] transition-transform active:scale-95`}>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">{posName}</span>
            <span className={`text-[7px] px-1 rounded-sm font-black text-white ${rankColor}`}>{prefRank}</span>
          </div>
          <span className="text-[11px] font-black text-gray-800 leading-tight mb-0.5 truncate w-full text-center">{anonymizeName(p.profiles?.full_name)}</span>
          <div className="w-full h-[1px] bg-gray-50 my-1"></div>
          <span className="text-[9px] font-black text-gray-900 leading-none">{priorityScore.toFixed(0)}</span>
          <span className="text-[6px] font-bold text-gray-300 mt-1 scale-90">{weightText}</span>
        </div>
      );
    };

    return (
      <div className={`${bgColor} border-2 ${borderColor} rounded-[40px] p-6 space-y-5 shadow-inner`}>
        <div className="flex justify-between items-center px-2">
           <p className={`font-black text-sm uppercase tracking-widest ${textColor}`}>{teamType} COURT</p>
           <div className="flex flex-col items-end">
             <span className="text-[9px] font-black text-gray-400 mb-1">TEAM POWER: {avgSkill}</span>
             <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
               <div className={`h-full ${isA ? 'bg-red-400' : 'bg-blue-400'}`} style={{ width: `${(avgSkill/90)*100}%` }}></div>
             </div>
           </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            {renderPlayer('레프트')}
            {renderPlayer('속공')}
            {renderPlayer('세터')}
            {renderPlayer('라이트')}
          </div>
          <div className="flex justify-center gap-2 px-8">
            {renderPlayer('앞차')}
            {renderPlayer('백차')}
          </div>
          <div className="flex gap-2">
            {renderPlayer('레프트백')}
            {renderPlayer('센터백')}
            {renderPlayer('라이트백')}
          </div>
        </div>
      </div>
    );
  };

  const openEditModal = (participant?: any) => {
    if (participant) {
      setEditingParticipant(participant);
      setJoinForm({
        pos_1st: participant.pos_1st || '레프트', pos_2nd: participant.pos_2nd || '선택 안함',
        pos_3rd: participant.pos_3rd || '선택 안함', pos_exclude: participant.pos_exclude || '선택 안함',
        available_sets: participant.available_sets?.split(',') || []
      });
    } else {
      setEditingParticipant(null);
      const myData = participants.find(p => p.user_id === user?.id);
      setJoinForm(myData ? {
        pos_1st: myData.pos_1st, pos_2nd: myData.pos_2nd, pos_3rd: myData.pos_3rd,
        pos_exclude: myData.pos_exclude || '선택 안함', available_sets: myData.available_sets?.split(',') || []
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
      const sortedSets = [...joinForm.available_sets].sort((a,b) => parseInt(a) - parseInt(b)).join(',');
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
        alert('신청 완료!');
      }
      setShowPositionModal(false);
    } catch (e: any) { alert(`오류: ${e.message}`); } finally { setIsSubmitting(false); }
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
        const priorityScore = 100 - ((history1st[p.id] || 0) * 10) + (mileage[p.id] || 0) + Math.random();
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
    alert('4라운드 라인업 생성이 완료되었습니다!'); fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center font-bold">로딩 중...</div>;

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

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {activeTab === 'info' ? (
          <>
            <div className="bg-white p-6 rounded-[32px] shadow-sm border font-bold">
               <h2 className="text-2xl font-black mb-4 leading-tight">{match.title}</h2>
               <div className="space-y-1.5 text-sm text-gray-500">
                 <p className="flex items-center gap-2 font-black"><Calendar className="w-4 h-4 text-sport-blue"/> {match.match_date}</p>
                 <p className="flex items-center gap-2 font-black"><MapPin className="w-4 h-4 text-sport-blue"/> {match.location}</p>
                 <p className="flex items-center gap-2 font-black"><Users className="w-4 h-4 text-sport-blue"/> {participants.length}명 신청 완료</p>
               </div>
            </div>
            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Zap className="text-yellow-400 fill-yellow-400 w-5 h-5"/> 알고리즘 라인업 가동
              </button>
            )}
            <div className="space-y-3">
              <h3 className="font-black text-lg px-1">신청자 명단 ({participants.length}명)</h3>
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white p-4 rounded-[24px] border shadow-sm">
                  <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center font-bold text-sport-blue overflow-hidden border">
                    {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : p.profiles?.full_name?.[0]}
                  </div>
                  <div className="flex-1 font-black">
                    <p className="text-sm">{p.profiles?.full_name}</p>
                    <p className="text-[10px] text-gray-400">{p.available_sets?.split(',').sort((a,b)=>parseInt(a)-parseInt(b)).join(', ')}세트</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black text-sport-blue bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{p.pos_1st}</div>
                    {isManager && <button onClick={() => openEditModal(p)} className="p-2.5 bg-gray-50 rounded-xl text-gray-400"><Settings className="w-4 h-4"/></button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              {[1, 2, 3, 4].map(r => (
                <button key={r} onClick={() => setActiveRound(r)} className={`px-6 py-3 rounded-full font-black text-sm whitespace-nowrap transition-all border-2 ${activeRound === r ? 'bg-sport-blue border-sport-blue text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>
                  {r*2-1}·{r*2} SET
                </button>
              ))}
            </div>

            { (match.is_lineup_visible || isManager) ? (
              <div className="space-y-8 pb-20">
                <CourtView teamPlayers={participants.filter(p => p[`team_r${activeRound}`] === 'A팀')} teamType="A팀" round={activeRound} />
                <div className="flex items-center justify-center py-2">
                  <div className="h-[2px] bg-gray-200 flex-1 rounded-full"></div>
                  <span className="px-6 text-[10px] font-black text-gray-300 uppercase tracking-widest">Net Area</span>
                  <div className="h-[2px] bg-gray-200 flex-1 rounded-full"></div>
                </div>
                <CourtView teamPlayers={participants.filter(p => p[`team_r${activeRound}`] === 'B팀')} teamType="B팀" round={activeRound} />

                { participants.some(p => p[`pos_r${activeRound}`] === '대기') && (
                  <div className="bg-white p-6 rounded-[40px] border-2 border-dashed border-gray-200">
                    <p className="text-[11px] font-black text-gray-400 mb-4 flex items-center gap-2 uppercase tracking-tight">
                      <Clock className="w-4 h-4"/> 대기 선수 명단 (보상 +10)
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {participants.filter(p => p[`pos_r${activeRound}`] === '대기').map(p => (
                        <div key={p.id} className="bg-gray-50 p-3 rounded-2xl text-center border border-gray-100">
                          <p className="text-[11px] font-black text-gray-800">{anonymizeName(p.profiles?.full_name)}</p>
                          <p className="text-[8px] font-black text-gray-400 mt-1 uppercase">1ST: {p.pos_1st}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="py-24 text-center font-black text-gray-300">라인업이 비공개 상태입니다. 🕵️‍♂️</div>}
          </div>
        )}
      </main>

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-8 max-h-[85vh] overflow-y-auto">
            <h3 className="text-2xl font-black mb-8">{editingParticipant ? `${editingParticipant.profiles?.full_name}님 수정` : '참가 신청'}</h3>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-black mb-4 block text-gray-600">참여 가능한 세트</label>
                <div className="grid grid-cols-4 gap-2">
                  {["1","2","3","4","5","6","7","8"].map(s => (
                    <button key={s} onClick={() => {
                      const curr = joinForm.available_sets;
                      setJoinForm({...joinForm, available_sets: curr.includes(s) ? curr.filter(v => v !== s) : [...curr, s]});
                    }} className={`py-4 rounded-2xl font-black text-sm border-2 ${joinForm.available_sets.includes(s) ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100 text-gray-400'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 pt-4">
                <select className="w-full p-4 rounded-2xl border-2 font-black text-gray-700 bg-gray-50" value={joinForm.pos_1st} onChange={e => setJoinForm({...joinForm, pos_1st: e.target.value})}>
                  {VOLLEYBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <select className="w-full p-4 rounded-2xl border-2 font-black text-gray-700 bg-gray-50" value={joinForm.pos_2nd} onChange={e => setJoinForm({...joinForm, pos_2nd: e.target.value})}>
                    {OPTIONAL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select className="w-full p-4 rounded-2xl border-2 font-black text-gray-700 bg-gray-50" value={joinForm.pos_3rd} onChange={e => setJoinForm({...joinForm, pos_3rd: e.target.value})}>
                    {BONUS_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={submitJoin} disabled={isSubmitting} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-xl shadow-xl flex items-center justify-center gap-2 mt-4">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : '설정 완료하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto bg-gradient-to-t from-gray-50 via-gray-50 pt-10 z-10">
        <button onClick={() => openEditModal()} className="w-full py-5 rounded-[28px] font-black text-lg bg-sport-blue text-white shadow-2xl active:scale-95 transition-all">
          {isJoined ? '나의 신청 내역 수정하기' : '지금 참가 신청하기 🏐'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
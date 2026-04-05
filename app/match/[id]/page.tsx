'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X, Download, BarChart3, Clock, Settings, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const VOLLEYBALL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백", "상관없음"];
const REAL_POSITIONS = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];
const OPTIONAL_POSITIONS = ["선택 안함", ...VOLLEYBALL_POSITIONS];
const BONUS_POSITIONS = ["선택 안함", "속공", "레프트백", "센터백", "라이트백"];

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
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [editingParticipant, setEditingParticipant] = useState<any>(null); 
  const [joinForm, setJoinForm] = useState({
    pos_1st: '레프트',
    pos_2nd: '선택 안함',
    pos_3rd: '선택 안함',
    pos_exclude: '선택 안함',
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

  const isJoined = participants.some((p) => p.user_id === user?.id);
  const isManager = user?.id === match?.manager_id;

  // 세트 번호를 보기 좋게 정렬하는 헬퍼 함수
  const sortSets = (setsArray: string[]) => {
    return [...setsArray]
      .filter(Boolean) // 빈 값 제거
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (isNaN(numA)) return 1; // 숫자가 아닌 경우(예: '끝장') 뒤로 보냄
        if (isNaN(numB)) return -1;
        return numA - numB;
      });
  };

  const openEditModal = (participant?: any) => {
    if (participant) {
      setEditingParticipant(participant);
      setJoinForm({
        pos_1st: participant.pos_1st || '레프트',
        pos_2nd: participant.pos_2nd || '선택 안함',
        pos_3rd: participant.pos_3rd || '선택 안함',
        pos_exclude: participant.pos_exclude || '선택 안함',
        available_sets: sortSets(participant.available_sets?.split(',') || [])
      });
    } else {
      setEditingParticipant(null);
      const myData = participants.find(p => p.user_id === user?.id);
      if (myData) {
        setJoinForm({
          pos_1st: myData.pos_1st, pos_2nd: myData.pos_2nd, pos_3rd: myData.pos_3rd,
          pos_exclude: myData.pos_exclude || '선택 안함',
          available_sets: sortSets(myData.available_sets?.split(',') || [])
        });
      } else {
        setJoinForm({
          pos_1st: '레프트', pos_2nd: '선택 안함', pos_3rd: '선택 안함', pos_exclude: '선택 안함',
          available_sets: ["1","2","3","4","5","6","7","8"]
        });
      }
    }
    setShowPositionModal(true);
  };

  const submitJoin = async () => {
    if (joinForm.available_sets.length === 0) return alert('세트를 선택해주세요.');
    
    try {
      setIsSubmitting(true);
      // 저장하기 전에 세트 번호를 오름차순으로 정렬합니다.
      const sortedSetsStr = sortSets(joinForm.available_sets).join(',');

      const payload = {
        pos_1st: joinForm.pos_1st, 
        pos_2nd: joinForm.pos_2nd, 
        pos_3rd: joinForm.pos_3rd,
        pos_exclude: joinForm.pos_exclude,
        available_sets: sortedSetsStr
      };

      const targetRecord = editingParticipant || participants.find(p => p.user_id === user?.id);

      if (targetRecord) {
        const { data: updatedResults, error } = await supabase.from('match_participants')
          .update(payload)
          .eq('id', targetRecord.id)
          .select('*, profiles(*)');
        
        if (error) throw error;
        if (!updatedResults || updatedResults.length === 0) throw new Error("수정 권한이 없습니다.");

        const updatedData = updatedResults[0];
        setParticipants(prev => prev.map(p => p.id === updatedData.id ? updatedData : p));
        alert(editingParticipant ? `${updatedData.profiles?.full_name}님의 정보가 수정되었습니다!` : '정보가 수정되었습니다!');
      } else {
        const { data: newResults, error } = await supabase.from('match_participants')
          .insert([{ ...payload, match_id: matchId, user_id: user.id }])
          .select('*, profiles(*)');
        
        if (error) throw error;
        if (newResults && newResults.length > 0) {
          setParticipants(prev => [...prev, newResults[0]]);
          alert('참가 신청이 완료되었습니다!');
        }
      }
      setShowPositionModal(false);
    } catch (e: any) {
      alert(`❌ 오류 발생: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateLineup = async () => {
    if (!confirm('공평 배정 로직으로 라인업을 생성하시겠습니까?')) return;
    const history1st: Record<string, number> = {};
    const mileage: Record<string, number> = {};
    participants.forEach(p => { history1st[p.id] = 0; mileage[p.id] = 0; });
    const getSkillScore = (lvl: string) => ({ '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 }[lvl] || 50);

    for (let r = 1; r <= 4; r++) {
      const setA = String(r * 2 - 1); const setB = String(r * 2);
      const pool = participants.filter(p => {
        const sets = p.available_sets?.split(',') || [];
        return sets.includes(setA) || sets.includes(setB);
      }).map(p => {
        const priorityScore = 100 - ((history1st[p.id] || 0) * 10) + (mileage[p.id] || 0) + Math.random();
        return { ...p, priorityScore, skillScore: getSkillScore(p.profiles?.skill_level) };
      });
      if (pool.length < 6) continue;
      const sortedBySkill = [...pool].sort((a, b) => b.skillScore - a.skillScore);
      const teamA: any[] = []; const teamB: any[] = [];
      sortedBySkill.forEach((p, idx) => { if (idx % 4 === 0 || idx % 4 === 3) teamA.push(p); else teamB.push(p); });
      const assign = (team: any[]) => {
        const sortedTeam = [...team].sort((a, b) => b.priorityScore - a.priorityScore);
        let remainingPos = [...REAL_POSITIONS]; const results: any[] = [];
        sortedTeam.forEach(p => {
          let finalPos = "대기"; let matchType = "wait";
          const wishes = [{ pos: p.pos_1st, type: "1st" }, { pos: p.pos_2nd, type: "2nd" }, { pos: p.pos_3rd, type: "3rd" }].filter(w => w.pos && w.pos !== "선택 안함");
          for (const wish of wishes) { if (remainingPos.includes(wish.pos)) { finalPos = wish.pos; matchType = wish.type; break; } }
          if (finalPos === "대기" && remainingPos.length > 0) {
            const safePos = remainingPos.filter(pos => pos !== p.pos_exclude);
            finalPos = safePos.length > 0 ? safePos[Math.floor(Math.random() * safePos.length)] : remainingPos[0];
            matchType = "random";
          }
          if (finalPos !== "대기") remainingPos = remainingPos.filter(v => v !== finalPos);
          if (matchType === "1st") history1st[p.id]++;
          else if (matchType === "2nd") mileage[p.id] += 3;
          else if (matchType === "3rd") mileage[p.id] += 5;
          else if (matchType === "wait" || matchType === "random") mileage[p.id] += 10;
          results.push({ id: p.id, pos: finalPos });
        });
        return results;
      };
      const finalRoundData = [...assign(teamA).map(res => ({ ...res, team: 'A팀' })), ...assign(teamB).map(res => ({ ...res, team: 'B팀' }))];
      for (const res of finalRoundData) { await supabase.from('match_participants').update({ [`team_r${r}`]: res.team, [`pos_r${r}`]: res.pos }).eq('id', res.id); }
    }
    alert('라인업 생성이 완료되었습니다! 🤖');
    fetchMatchDetails();
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
            <button onClick={() => { if(confirm('삭제?')) supabase.from('matches').delete().eq('id', matchId).then(() => router.push('/')) }}><Trash2 className="text-red-500" /></button>
          </div>
        )}
      </header>

      <div className="bg-white border-b sticky top-14 z-20">
        <div className="flex max-w-lg mx-auto">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 font-black text-sm ${activeTab === 'info' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>정보/명단</button>
          <button onClick={() => setActiveTab('lineup')} className={`flex-1 py-4 font-black text-sm ${activeTab === 'lineup' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>알고리즘 라인업</button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {activeTab === 'info' ? (
          <>
            <div className="bg-white p-6 rounded-[32px] shadow-sm border font-bold">
               <h2 className="text-2xl font-black mb-4 leading-tight">{match.title}</h2>
               <div className="space-y-2">
                 <p className="flex items-center gap-2 text-gray-500 text-sm"><Calendar className="w-4 h-4 text-sport-blue"/> {match.match_date}</p>
                 <p className="flex items-center gap-2 text-gray-500 text-sm"><MapPin className="w-4 h-4 text-sport-blue"/> {match.location}</p>
                 <p className="flex items-center gap-2 text-gray-500 text-sm"><Users className="w-4 h-4 text-sport-blue"/> {participants.length} / {match.max_participants}명 신청 중</p>
               </div>
            </div>
            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Zap className="text-yellow-400 fill-yellow-400 w-5 h-5"/> 알고리즘 라인업 생성
              </button>
            )}
            <div className="space-y-3">
              <h3 className="font-black text-lg px-1 flex justify-between items-center">신청자 명단 <span className="text-sport-blue text-sm">{participants.length}명</span></h3>
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white p-4 rounded-2xl border shadow-sm transition-all">
                  <div className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center font-bold text-sport-blue overflow-hidden border border-blue-100">
                    {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : <User className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-gray-900 text-sm">{p.profiles?.full_name}</p>
                    {/* 화면 표시 시 세트 번호를 정렬하여 보여줍니다. */}
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                      {sortSets(p.available_sets?.split(',') || []).join(', ')}세트 참여
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] font-black text-sport-blue bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">{p.pos_1st}</div>
                    {isManager && (
                      <button onClick={() => openEditModal(p)} className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-sport-blue hover:bg-blue-50 transition-all border border-gray-100">
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-8">
            {(match.is_lineup_visible || isManager) ? (
              [1, 2, 3, 4].map(r => (
                <div key={r} className="space-y-4">
                  <h3 className="font-black text-lg text-sport-blue bg-blue-50 p-3 rounded-2xl border border-blue-100 inline-block">{r*2-1}·{r*2}세트 라인업</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {['A팀', 'B팀'].map(t => (
                      <div key={t} className={`p-5 rounded-[32px] border-2 shadow-sm ${t === 'A팀' ? 'bg-red-50/30 border-red-100' : 'bg-blue-50/30 border-blue-100'}`}>
                        <p className={`font-black text-xs mb-4 uppercase tracking-wider ${t === 'A팀' ? 'text-red-500' : 'text-blue-500'}`}>{t} 코트</p>
                        <div className="grid grid-cols-3 gap-3">
                          {participants.filter(p => p[`team_r${r}`] === t).map(p => (
                            <div key={p.id} className="bg-white p-3 rounded-2xl text-center border border-gray-100 shadow-sm">
                              <p className="text-[9px] text-gray-400 font-black mb-1.5 leading-none uppercase">{p[`pos_r${r}`]}</p>
                              <p className="text-xs font-black truncate text-gray-800">{p.profiles?.full_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : <div className="py-24 text-center font-black text-gray-300">라인업이 아직 비공개 상태입니다. 🕵️‍♂️</div>}
          </div>
        )}
      </main>

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-8 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-gray-900">
                {editingParticipant ? `${editingParticipant.profiles?.full_name}님 정보 수정` : '매치 참가 신청'}
              </h3>
              <button onClick={() => setShowPositionModal(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X /></button>
            </div>
            
            <div className="space-y-8">
              <div>
                <label className="text-sm font-black mb-4 block text-gray-700 ml-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sport-blue"/> 참여 가능한 세트 (중복 선택)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["1","2","3","4","5","6","7","8"].map(s => {
                    const active = joinForm.available_sets.includes(s);
                    return (
                      <button key={s} onClick={() => {
                        const curr = joinForm.available_sets;
                        setJoinForm({...joinForm, available_sets: active ? curr.filter(v => v !== s) : [...curr, s]});
                      }} className={`py-3 rounded-2xl font-black text-sm border-2 transition-all ${active ? 'border-sport-blue bg-blue-50 text-sport-blue shadow-md shadow-blue-100' : 'border-gray-100 bg-white text-gray-400'}`}>{s}세트</button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 ml-2 uppercase">1순위 선호 포지션</label>
                  <select className="w-full p-4 rounded-2xl border-2 border-gray-50 bg-gray-50 font-black outline-none focus:border-sport-blue focus:bg-white transition-all appearance-none" value={joinForm.pos_1st} onChange={e => setJoinForm({...joinForm, pos_1st: e.target.value})}>
                    {VOLLEYBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-2 uppercase">2순위 (차선)</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-gray-50 bg-gray-50 font-black outline-none focus:border-sport-blue focus:bg-white transition-all appearance-none" value={joinForm.pos_2nd} onChange={e => setJoinForm({...joinForm, pos_2nd: e.target.value})}>
                      {OPTIONAL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 ml-2 uppercase">3순위 (가산점)</label>
                    <select className="w-full p-4 rounded-2xl border-2 border-gray-50 bg-gray-50 font-black outline-none focus:border-sport-blue focus:bg-white transition-all appearance-none" value={joinForm.pos_3rd} onChange={e => setJoinForm({...joinForm, pos_3rd: e.target.value})}>
                      {BONUS_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button onClick={submitJoin} disabled={isSubmitting} className="w-full py-5 bg-gray-900 text-white rounded-[24px] font-black text-xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (editingParticipant ? '수정 내용 저장하기' : '이대로 신청 완료하기')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto bg-gradient-to-t from-gray-50 via-gray-50/80 pt-12 z-10">
        <button onClick={() => openEditModal()} className="w-full py-5 rounded-[24px] font-black text-lg bg-sport-blue text-white shadow-2xl shadow-blue-200 active:scale-95 transition-all">
          {isJoined ? '나의 신청 정보 수정' : '지금 참가 신청하기 🏐'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { 
  ArrowLeft, Calendar, MapPin, Users, Trash2, Edit3, 
  User, Zap, Eye, EyeOff, X, Download, BarChart3, Clock, Settings
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  
  // 신청 수정용 상태
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any>(null); // 누구를 수정 중인지 저장
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
      if (currentUser) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        setUserProfile(profileData);
      }
      const { data: matchData } = await supabase.from('matches').select('*').eq('id', matchId).single();
      setMatch(matchData);
      const { data: partData } = await supabase.from('match_participants').select('*, profiles(*)').eq('match_id', matchId);
      setParticipants(partData || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { fetchMatchDetails(); }, [fetchMatchDetails]);

  const isJoined = participants.some((p) => p.user_id === user?.id);
  const isManager = user?.id === match?.manager_id;

  // --- 🛠️ 마스터 권한 수정 함수 ---
  const openEditModal = (participant?: any) => {
    if (participant) {
      // 관리자가 특정 인원을 수정할 때
      setEditingParticipant(participant);
      setJoinForm({
        pos_1st: participant.pos_1st || '레프트',
        pos_2nd: participant.pos_2nd || '선택 안함',
        pos_3rd: participant.pos_3rd || '선택 안함',
        pos_exclude: participant.pos_exclude || '선택 안함',
        available_sets: participant.available_sets?.split(',') || []
      });
    } else {
      // 본인이 본인 거 신청/수정할 때
      setEditingParticipant(null);
      const myData = participants.find(p => p.user_id === user.id);
      if (myData) {
        setJoinForm({
          pos_1st: myData.pos_1st, pos_2nd: myData.pos_2nd, pos_3rd: myData.pos_3rd,
          pos_exclude: myData.pos_exclude || '선택 안함',
          available_sets: myData.available_sets?.split(',') || []
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
    
    // 대상 결정: 관리자 수정 중이면 해당 유저, 아니면 본인
    const targetUserId = editingParticipant ? editingParticipant.user_id : user.id;
    const isTargetJoined = participants.some(p => p.user_id === targetUserId);

    const payload = {
      match_id: matchId, 
      user_id: targetUserId,
      pos_1st: joinForm.pos_1st, 
      pos_2nd: joinForm.pos_2nd, 
      pos_3rd: joinForm.pos_3rd,
      pos_exclude: joinForm.pos_exclude,
      available_sets: joinForm.available_sets.join(',')
    };

    try {
      if (isTargetJoined) {
        await supabase.from('match_participants').update(payload).eq('match_id', matchId).eq('user_id', targetUserId);
      } else {
        await supabase.from('match_participants').insert([payload]);
      }
      alert(editingParticipant ? `${editingParticipant.profiles?.full_name}님의 내역을 수정했습니다.` : '신청 완료!');
      setShowPositionModal(false);
      fetchMatchDetails();
    } catch (e) {
      alert('오류가 발생했습니다.');
    }
  };

  // --- 🏐 공평 배정 알고리즘 (기존 로직 유지) ---
  const generateLineup = async () => {
    if (!confirm('공평 배정 로직으로 라인업을 생성하시겠습니까?')) return;
    const history1st: Record<string, number> = {};
    const mileage: Record<string, number> = {};
    participants.forEach(p => { history1st[p.id] = 0; mileage[p.id] = 0; });
    const getSkillScore = (lvl: string) => ({ '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 }[lvl] || 50);

    for (let r = 1; r <= 4; r++) {
      const setA = String(r * 2 - 1);
      const setB = String(r * 2);
      const pool = participants.filter(p => {
        const sets = p.available_sets?.split(',') || [];
        return sets.includes(setA) || sets.includes(setB);
      }).map(p => {
        const baseScore = 100; 
        const priorityScore = baseScore - ((history1st[p.id] || 0) * 10) + (mileage[p.id] || 0) + Math.random();
        return { ...p, priorityScore, skillScore: getSkillScore(p.profiles?.skill_level) };
      });

      if (pool.length < 6) continue;
      const sortedBySkill = [...pool].sort((a, b) => b.skillScore - a.skillScore);
      const teamA: any[] = []; const teamB: any[] = [];
      sortedBySkill.forEach((p, idx) => { if (idx % 4 === 0 || idx % 4 === 3) teamA.push(p); else teamB.push(p); });

      const assign = (team: any[]) => {
        const sortedTeam = [...team].sort((a, b) => b.priorityScore - a.priorityScore);
        let remainingPos = [...REAL_POSITIONS];
        const results: any[] = [];
        sortedTeam.forEach(p => {
          let finalPos = "대기"; let matchType = "wait";
          const wishes = [{ pos: p.pos_1st, type: "1st" }, { pos: p.pos_2nd, type: "2nd" }, { pos: p.pos_3rd, type: "3rd" }].filter(w => w.pos && w.pos !== "선택 안함" && w.pos !== "상관없음");
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
      for (const res of finalRoundData) {
        await supabase.from('match_participants').update({ [`team_r${r}`]: res.team, [`pos_r${r}`]: res.pos }).eq('id', res.id);
      }
    }
    alert('라인업 생성이 완료되었습니다! 🤖');
    fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center font-bold">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-44">
      <header className="bg-white border-b sticky top-0 z-20 flex p-4 max-w-lg mx-auto justify-between items-center font-bold">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}><ArrowLeft /></button>
          <h1>매치 상세</h1>
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
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 font-bold ${activeTab === 'info' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>정보</button>
          <button onClick={() => setActiveTab('lineup')} className={`flex-1 py-4 font-bold ${activeTab === 'lineup' ? 'border-b-4 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>라인업</button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        {activeTab === 'info' ? (
          <>
            <div className="bg-white p-6 rounded-3xl shadow-sm border font-bold">
               <h2 className="text-2xl font-black mb-4">{match.title}</h2>
               <p className="flex items-center gap-2 text-gray-500"><Calendar className="w-4 h-4"/> {match.match_date}</p>
               <p className="flex items-center gap-2 text-gray-500"><MapPin className="w-4 h-4"/> {match.location}</p>
            </div>
            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                <Zap className="text-yellow-400 fill-yellow-400"/> 알고리즘 라인업 생성
              </button>
            )}
            <div className="space-y-2">
              <h3 className="font-black text-lg">신청자 명단 ({participants.length}명)</h3>
              {participants.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center font-bold text-sport-blue text-xs overflow-hidden">
                    {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="w-full h-full object-cover" /> : p.profiles?.full_name?.[0]}
                  </div>
                  <div className="flex-1 font-bold">
                    <p className="text-sm">{p.profiles?.full_name}</p>
                    <p className="text-[10px] text-gray-400">{p.available_sets}세트 참여</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-sport-blue bg-blue-50 px-2 py-1 rounded-lg">{p.pos_1st}</div>
                    {/* 마스터 수정 버튼 추가 */}
                    {isManager && (
                      <button onClick={() => openEditModal(p)} className="p-1.5 bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200">
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
                  <h3 className="font-black text-lg text-sport-blue bg-blue-50 p-3 rounded-xl inline-block">{r*2-1}·{r*2}세트 라인업</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {['A팀', 'B팀'].map(t => (
                      <div key={t} className={`p-4 rounded-3xl border-2 ${t === 'A팀' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                        <p className={`font-black text-xs mb-3 ${t === 'A팀' ? 'text-red-500' : 'text-blue-500'}`}>{t} 코트</p>
                        <div className="grid grid-cols-3 gap-2">
                          {participants.filter(p => p[`team_r${r}`] === t).map(p => (
                            <div key={p.id} className="bg-white p-2 rounded-xl text-center border">
                              <p className="text-[9px] text-gray-400 font-bold">{p[`pos_r${r}`]}</p>
                              <p className="text-xs font-bold truncate">{p.profiles?.full_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : <div className="py-20 text-center font-bold text-gray-400">라인업 비공개</div>}
          </div>
        )}
      </main>

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-2xl font-black mb-6">
              {editingParticipant ? `${editingParticipant.profiles?.full_name}님 수정` : '참가 신청'}
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-black mb-2 block text-gray-600">참가 가능 세트</label>
                <div className="flex flex-wrap gap-2">
                  {["1","2","3","4","5","6","7","8"].map(s => (
                    <button key={s} onClick={() => {
                      const curr = joinForm.available_sets;
                      setJoinForm({...joinForm, available_sets: curr.includes(s) ? curr.filter(v => v !== s) : [...curr, s]});
                    }} className={`px-4 py-2 rounded-xl font-bold border-2 transition-all ${joinForm.available_sets.includes(s) ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100 bg-white text-gray-400'}`}>{s}세트</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 ml-1">1순위 희망 포지션</label>
                  <select className="w-full mt-1 p-4 rounded-2xl border-2 font-bold bg-white" value={joinForm.pos_1st} onChange={e => setJoinForm({...joinForm, pos_1st: e.target.value})}>
                    {VOLLEYBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-black text-gray-400 ml-1">2순위</label>
                  <select className="w-full mt-1 p-4 rounded-2xl border-2 font-bold bg-white" value={joinForm.pos_2nd} onChange={e => setJoinForm({...joinForm, pos_2nd: e.target.value})}>
                    {OPTIONAL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                  <div><label className="text-xs font-black text-gray-400 ml-1">3순위</label>
                  <select className="w-full mt-1 p-4 rounded-2xl border-2 font-bold bg-white" value={joinForm.pos_3rd} onChange={e => setJoinForm({...joinForm, pos_3rd: e.target.value})}>
                    {BONUS_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                </div>
              </div>
              <button onClick={submitJoin} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black shadow-xl">
                {editingParticipant ? '수정 완료 (관리자)' : '신청 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto bg-gradient-to-t from-gray-50 pt-10">
        <button onClick={() => openEditModal()} className="w-full py-5 rounded-2xl font-black bg-sport-blue text-white shadow-xl">
          {isJoined ? '신청 내용 수정' : '지금 참가 신청하기'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
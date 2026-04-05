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
    available_sets: [] as string[] 
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

  // --- 🧠 희성님 운영 방식 기반 알고리즘 ---
  const generateLineup = async () => {
    if (!confirm('운영 로직에 따라 4라운드 라인업을 생성하시겠습니까?')) return;
    
    // 1. 모든 참가자 점수화
    const getSkillScore = (level: string) => ({ '최상급': 90, '고급': 80, '중급': 70, '초급': 60, '입문': 50 }[level] || 50);
    
    // 2. 라운드별 배정 시작 (R1~R4)
    for (let r = 1; r <= 4; r++) {
      // 해당 라운드 세트 (R1: 1,2 / R2: 3,4 / R3: 5,6 / R4: 7,8)
      const setA = String(r * 2 - 1);
      const setB = String(r * 2);

      // 이번 라운드에 참가 가능한 사람만 필터링
      const availablePlayers = participants.filter(p => {
        const userSets = p.available_sets?.split(',') || [];
        return userSets.includes(setA) || userSets.includes(setB);
      }).map(p => ({
        ...p,
        tempScore: getSkillScore(p.profiles?.skill_level) + (p.pos_3rd !== '선택 안함' ? 5 : 0) + (Math.random() * 5)
      })).sort((a, b) => b.tempScore - a.tempScore);

      if (availablePlayers.length < 12) {
        console.warn(`${r}라운드 인원 부족 (${availablePlayers.length}명)`);
      }

      // 실력 순 A-B-B-A 배정
      const teamA: any[] = [];
      const teamB: any[] = [];
      availablePlayers.forEach((p, idx) => {
        if (idx % 4 === 0 || idx % 4 === 3) teamA.push(p);
        else teamB.push(p);
      });

      // 포지션 배정 함수
      const assign = (team: any[]) => {
        let pool = [...REAL_POSITIONS];
        let result: any[] = [];
        team.forEach(p => {
          let finalPos: string | null = null;
          const prefs = [p.pos_1st, p.pos_2nd, p.pos_3rd].filter(v => v && v !== '선택 안함' && v !== '상관없음');
          for (let pr of prefs) { if (pool.includes(pr)) { finalPos = pr; break; } }
          
          if (!finalPos) {
            const safe = pool.filter(v => v !== p.pos_exclude);
            finalPos = safe.length > 0 ? safe[Math.floor(Math.random() * safe.length)] : (pool[0] || '대기');
          }
          if (finalPos !== '대기') pool = pool.filter(v => v !== finalPos);
          result.push({ id: p.id, pos: finalPos });
        });
        return result;
      };

      const finalResults = [
        ...assign(teamA).map(res => ({ ...res, team: 'A팀' })),
        ...assign(teamB).map(res => ({ ...res, team: 'B팀' }))
      ];

      // DB 업데이트
      for (const res of finalResults) {
        await supabase.from('match_participants').update({
          [`team_r${r}`]: res.team,
          [`pos_r${r}`]: res.pos
        }).eq('id', res.id);
      }
    }
    alert('4라운드 라인업 생성이 완료되었습니다! 🤖');
    fetchMatchDetails(); // 데이터 새로고침
  };

  const deleteMatch = async () => {
    if (!confirm('매치를 삭제하시겠습니까?')) return;
    await supabase.from('matches').delete().eq('id', matchId);
    router.push('/');
  };

  const submitJoin = async () => {
    if (joinForm.available_sets.length === 0) return alert('세트를 선택해주세요.');
    const payload = {
      match_id: matchId, user_id: user.id,
      pos_1st: joinForm.pos_1st, pos_2nd: joinForm.pos_2nd, pos_3rd: joinForm.pos_3rd,
      pos_exclude: joinForm.pos_exclude,
      available_sets: joinForm.available_sets.join(',')
    };
    if (isJoined) {
      await supabase.from('match_participants').update(payload).eq('match_id', matchId).eq('user_id', user.id);
    } else {
      await supabase.from('match_participants').insert([payload]);
    }
    setShowPositionModal(false);
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
            <button onClick={deleteMatch}><Trash2 className="text-red-500" /></button>
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
               <h2 className="text-2xl font-black mb-4">{match.title}</h2>
               <div className="space-y-2 text-sm font-bold text-gray-500">
                 <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-sport-blue"/> {format(new Date(match.match_date), 'M월 d일 HH:mm', { locale: ko })}</p>
                 <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-sport-blue"/> {match.location}</p>
                 <p className="flex items-center gap-2"><Users className="w-4 h-4 text-sport-blue"/> {participants.length} / {match.max_participants}명</p>
               </div>
            </div>

            {isManager && (
              <button onClick={generateLineup} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-2">
                <Zap className="text-yellow-400 fill-yellow-400"/> 알고리즘 라인업 생성
              </button>
            )}

            <div>
              <h3 className="font-black text-lg mb-4">신청자 명단 ({participants.length}명)</h3>
              <div className="grid grid-cols-1 gap-2">
                {participants.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border shadow-sm">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                      {p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} className="rounded-full" /> : <User className="text-sport-blue"/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{p.profiles?.full_name}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{p.available_sets || '전체'} 세트 참여</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-sport-blue">{p.pos_1st}</p>
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
                  <div className="grid grid-cols-1 gap-3">
                    {['A팀', 'B팀'].map(t => (
                      <div key={t} className={`p-4 rounded-3xl border-2 ${t === 'A팀' ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`}>
                        <p className={`font-black text-xs mb-3 ${t === 'A팀' ? 'text-red-500' : 'text-blue-500'}`}>{t} 코트</p>
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
              <div className="text-center py-20 text-gray-400 font-bold">라인업이 아직 비공개입니다.</div>
            )}
          </div>
        )}
      </main>

      {showPositionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">포지션 희망서</h3>
              <button onClick={() => setShowPositionModal(false)}><X /></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-black mb-3 block">참가 가능 세트 (최대 8세트)</label>
                <div className="flex flex-wrap gap-2">
                  {["1","2","3","4","5","6","7","8"].map(s => (
                    <button key={s} onClick={() => {
                      const curr = joinForm.available_sets;
                      setJoinForm({...joinForm, available_sets: curr.includes(s) ? curr.filter(v => v !== s) : [...curr, s]});
                    }} className={`px-4 py-2 rounded-xl font-bold border-2 ${joinForm.available_sets.includes(s) ? 'border-sport-blue bg-blue-50 text-sport-blue' : 'border-gray-100'}`}>{s}세트</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div><label className="text-xs font-black text-gray-400">1순위</label>
                <select className="w-full p-4 rounded-2xl border-2 font-bold" value={joinForm.pos_1st} onChange={e => setJoinForm({...joinForm, pos_1st: e.target.value})}>
                  {VOLLEYBALL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-black text-gray-400">2순위</label>
                  <select className="w-full p-4 rounded-2xl border-2 font-bold" value={joinForm.pos_2nd} onChange={e => setJoinForm({...joinForm, pos_2nd: e.target.value})}>
                    {OPTIONAL_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                  <div><label className="text-xs font-black text-gray-400">3순위</label>
                  <select className="w-full p-4 rounded-2xl border-2 font-bold" value={joinForm.pos_3rd} onChange={e => setJoinForm({...joinForm, pos_3rd: e.target.value})}>
                    {BONUS_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                </div>
              </div>
              <button onClick={submitJoin} className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black">신청 완료</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 p-4 max-w-lg mx-auto bg-gradient-to-t from-gray-50 pt-10">
        <button onClick={() => {
          if (isJoined) {
            const my = participants.find(p => p.user_id === user.id);
            setJoinForm({
              pos_1st: my.pos_1st, pos_2nd: my.pos_2nd, pos_3rd: my.pos_3rd, pos_exclude: my.pos_exclude,
              available_sets: my.available_sets?.split(',') || []
            });
          }
          setShowPositionModal(true);
        }} className="w-full py-5 rounded-2xl font-black bg-sport-blue text-white shadow-xl">
          {isJoined ? '신청 내용 수정' : '지금 참가 신청하기'}
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
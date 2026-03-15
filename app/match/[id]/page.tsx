'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, Match, SPORT_TYPES } from '@/lib/supabase';
import { BottomNav } from '@/components/bottom-nav';
import { ArrowLeft, Calendar, MapPin, Users, Info, Trash2, Edit3, User, ExternalLink, X, Zap, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 9인제 배구 포지션 설정 (보내주신 코드 기준)
const POSITIONS_ALL = ["레프트", "속공", "세터", "라이트", "앞차", "백차", "레프트백", "센터백", "라이트백"];

export default function MatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id;

  const [match, setMatch] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'lineup'

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
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { fetchMatchDetails(); }, [fetchMatchDetails]);

  // --- [핵심] 라인업 생성 알고리즘 (파이썬 로직 이식) ---
  const generateLineup = async () => {
    if (!confirm('기존 라인업을 초기화하고 새로 생성하시겠습니까?')) return;

    // 1. 점수 부여 (참여 횟수 등이 아직 없으므로 현재는 랜덤+레벨 기반 가상점수)
    let players = participants.map(p => ({
      ...p,
      score: 50 + Math.random() // 파이썬의 기본 50점 + 랜덤값 로직
    })).sort((a, b) => b.score - a.score); // 점수순 정렬

    // 2. 스네이크 드래프트 분배 (1-A, 2-B, 3-B, 4-A...)
    const rounds = [1, 2, 3, 4];
    for (const r of rounds) {
      let teamA: any[] = [];
      let teamB: any[] = [];
      
      players.forEach((p, idx) => {
        if ((idx % 4 === 0) || (idx % 4 === 3)) teamA.push(p);
        else teamB.push(p);
      });

      // 3. 각 팀내 포지션 배정 (1순위 -> 2순위 -> 3순위 -> 랜덤 순)
      const assignPositions = (team: any[]) => {
        let availablePos = [...POSITIONS_ALL];
        return team.map(p => {
          let finalPos = '대기';
          // 1~3순위 희망 포지션 체크
          for (let step = 1; step <= 3; step++) {
             const wish = p.position; // 현재는 position 하나만 받으므로 1순위로 처리
             if (availablePos.includes(wish)) {
               finalPos = wish;
               availablePos = availablePos.filter(pos => pos !== wish);
               break;
             }
          }
          // 남은 자리 랜덤 배정
          if (finalPos === '대기' && availablePos.length > 0) {
            finalPos = availablePos.shift() || '대기';
          }
          return { id: p.id, pos: finalPos };
        });
      };

      const resultsA = assignPositions(teamA);
      const resultsB = assignPositions(teamB);

      // 4. DB 업데이트 (세트별 팀 및 포지션 저장)
      for (const res of resultsA) {
        await supabase.from('match_participants').update({ [`team_r${r}`]: 'A팀', [`pos_r${r}`]: res.pos }).eq('id', res.id);
      }
      for (const res of resultsB) {
        await supabase.from('match_participants').update({ [`team_r${r}`]: 'B팀', [`pos_r${r}`]: res.pos }).eq('id', res.id);
      }
    }
    alert('공평한 라인업 생성이 완료되었습니다!');
    fetchMatchDetails();
  };

  const toggleVisibility = async () => {
    await supabase.from('matches').update({ is_lineup_visible: !match.is_lineup_visible }).eq('id', matchId);
    fetchMatchDetails();
  };

  if (loading) return <div className="p-10 text-center">불러오는 중...</div>;

  const isManager = user?.id === match?.manager_id;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 상단 탭 메뉴 */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="flex max-w-lg mx-auto">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-4 font-bold ${activeTab === 'info' ? 'border-b-2 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>매치 정보</button>
          <button onClick={() => setActiveTab('lineup')} className={`flex-1 py-4 font-bold ${activeTab === 'lineup' ? 'border-b-2 border-sport-blue text-sport-blue' : 'text-gray-400'}`}>라인업</button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4">
        {activeTab === 'info' ? (
          /* 기존 매치 정보 뷰 */
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border">
               <h2 className="text-2xl font-black mb-4">{match.title}</h2>
               <div className="text-sm text-gray-500 space-y-2">
                 <p>📍 {match.location}</p>
                 <p>⏰ {format(new Date(match.match_date), 'PPP p', { locale: ko })}</p>
                 <p>👥 인원: {participants.length} / {match.max_participants}명</p>
               </div>
            </div>
            {isManager && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={generateLineup} className="flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-bold"><Zap size={18}/> 라인업 생성</button>
                <button onClick={toggleVisibility} className="flex items-center justify-center gap-2 py-4 bg-white border rounded-2xl font-bold">
                  {match.is_lineup_visible ? <><EyeOff size={18}/> 비공개</> : <><Eye size={18}/> 라인업 공개</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* [핵심] 라인업 뷰 (Court View) */
          <div className="space-y-8">
            {!match.is_lineup_visible && !isManager ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
                <p className="text-gray-400">운영진이 라인업을 구성 중입니다... 🕵️‍♂️</p>
              </div>
            ) : (
              [1, 2, 3, 4].map(r => (
                <div key={r} className="space-y-4">
                  <h3 className="font-black text-lg text-sport-blue"> {r*2-1}·{r*2}세트 라인업</h3>
                  <div className="space-y-2">
                    {['A팀', 'B팀'].map(t => (
                      <div key={t} className={`p-4 rounded-2xl border ${t === 'A팀' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                        <p className={`font-bold text-sm mb-3 ${t === 'A팀' ? 'text-red-600' : 'text-blue-600'}`}>{t}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {participants.filter(p => p[`team_r${r}`] === t).map(p => (
                            <div key={p.id} className="bg-white p-2 rounded-lg shadow-sm text-center">
                              <p className="text-[10px] text-gray-400 font-bold">{p[`pos_r${r}`]}</p>
                              <p className="text-xs font-bold truncate">{p.profiles?.full_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
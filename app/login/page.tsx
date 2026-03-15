'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, ArrowLeft, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // 이메일 로그인 (테스트용)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('로그인 실패: ' + error.message);
    } else {
      router.push('/');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-sport-blue flex flex-col items-center justify-center p-4 relative">
      
      {/* 뒤로가기 버튼 */}
      <Link 
        href="/" 
        className="absolute top-8 left-8 text-white/80 hover:text-white flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-6 h-6" />
        <span className="font-medium">홈으로</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center mt-10">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">⚽</span>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-2">모두의 운동</h1>
        <p className="text-gray-500 mb-8">내 주변의 스포츠 매치에 참여해보세요</p>

        <div className="space-y-4">
          {/* 카카오 로그인 버튼 */}
          <button
            onClick={handleKakaoLogin}
            className="w-full bg-[#FEE500] text-[#191919] h-14 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-[#FADA0A] transition-colors"
          >
            <MessageCircle className="w-6 h-6 fill-current" />
            카카오로 시작하기
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">또는</span>
            </div>
          </div>

          {!showEmailLogin ? (
            <button
              onClick={() => setShowEmailLogin(true)}
              className="w-full h-14 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              이메일로 테스트하기
            </button>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="relative">
                <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="이메일 주소"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sport-blue"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-sport-blue"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-13 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-8 text-xs text-gray-400 leading-relaxed">
          로그인하면 서비스 이용약관 및<br />
          개인정보 처리방침에 동의하는 것으로 간주됩니다
        </p>
      </div>

      <div className="mt-8 text-white/60 text-sm font-medium">
        배구 • 풋살 • 농구 • 배드민턴 • 테니스
      </div>
    </div>
  );
}
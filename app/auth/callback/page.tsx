'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase가 카카오에서 받아온 인증 정보를 처리합니다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        // 로그인 성공 시 메인 페이지('/')로 부드럽게 이동합니다.
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center font-bold text-sport-blue text-xl animate-pulse">
        🏐 로그인 처리 중입니다. 잠시만 기다려주세요...
      </div>
    </div>
  );
}
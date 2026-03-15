'use client';

import { BottomNav } from '@/components/bottom-nav';
import { MessageCircle } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">채팅</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center py-12">
          <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">채팅 기능은 준비 중입니다</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

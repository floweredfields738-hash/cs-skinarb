import React from 'react';
import { MessageSquare } from 'lucide-react';

const Chats: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center glass-panel p-10 max-w-md">
      <MessageSquare className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Chats</h2>
      <p className="text-gray-500 text-sm">Community chat rooms coming soon.</p>
    </div>
  </div>
);

export default Chats;

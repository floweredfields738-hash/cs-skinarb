import React from 'react';
import { Copy } from 'lucide-react';

const Copying: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center glass-panel p-10 max-w-md">
      <Copy className="w-12 h-12 text-cyan-glow/30 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Copy Trading</h2>
      <p className="text-gray-500 text-sm">Follow top traders and copy their moves. Coming soon.</p>
    </div>
  </div>
);

export default Copying;

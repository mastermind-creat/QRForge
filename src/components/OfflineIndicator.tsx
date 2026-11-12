import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium tracking-tight backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode</span>
    </div>
  );
};

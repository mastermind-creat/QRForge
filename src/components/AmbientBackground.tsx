import React from 'react';

export const AmbientBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-gradient-to-b from-[#05060f] via-[#080d24] to-[#05060f]"
      aria-hidden="true"
    >
      {/* Primary Electric Blue Floating Orb */}
      <div
        className="animate-orb-1 absolute -top-24 -left-24 w-96 h-96 md:w-[540px] md:h-[540px] rounded-full bg-[#2f6bff]/20 blur-[110px]"
      />

      {/* Red Accent Floating Orb */}
      <div
        className="animate-orb-2 absolute top-1/3 -right-20 w-80 h-80 md:w-[480px] md:h-[480px] rounded-full bg-[#ff3b4e]/14 blur-[120px]"
      />

      {/* Secondary Deep Azure Floating Orb */}
      <div
        className="animate-orb-3 absolute -bottom-32 left-1/4 w-96 h-96 md:w-[500px] md:h-[500px] rounded-full bg-[#1b3a99]/25 blur-[130px]"
      />

      {/* Subtle geometric dot matrix grid texture */}
      <div
        className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
      />
    </div>
  );
};

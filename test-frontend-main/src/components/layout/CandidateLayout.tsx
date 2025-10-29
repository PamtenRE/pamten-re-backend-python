// src/components/layout/CandidateLayout.tsx
'use client';

import React from 'react';
import CandidateSidebar from './CandidateSidebar'; // Import the new sidebar

interface CandidateLayoutProps {
  children: React.ReactNode;
}

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <CandidateSidebar />

      {/* Main Content Area */}
      {/* Added pt-16 to push content below the fixed Navbar,
          and ml-60 to make space for the fixed sidebar.
          The overflow-auto ensures content scrolls within this area. */}
      <div className="flex flex-col flex-1 overflow-auto pt-16 ml-60">
        <main className="p-6 bg-gradient-to-b from-black to-neutral-900 min-h-full text-white">
          {children}
        </main>
      </div>
    </div>
  );
}

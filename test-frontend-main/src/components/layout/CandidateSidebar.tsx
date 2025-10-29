// src/components/layout/CandidateSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, User, LogOut, Search, FileEdit } from 'lucide-react'; // Added FileEdit icon for Resume Builder
import RecruitEdgeLogo from '@/components/RecruitEdgeLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const navLinks = [
  { name: 'Dashboard', href: '/candidate/dashboard', icon: <Briefcase size={20} /> },
  { name: 'Browse Jobs', href: '/candidate/jobs', icon: <Search size={20} /> },
  { name: 'Resume Builder', href: '/candidate/resume-builder', icon: <FileEdit size={20} /> }, // New link for Resume Builder
  { name: 'Profile', href: '/candidate/profile', icon: <User size={20} /> },
];

export default function CandidateSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <aside className="fixed top-[4rem] left-0 h-[calc(100%-4rem)] w-60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-r border-gray-200 dark:border-zinc-800 p-6 flex flex-col justify-between transition-colors duration-300 z-50">
      <div>
        {/* Removed the RecruitEdgeLogo component from here to remove the blue user icon */}
        {/* Keeping only the branding text if desired, or remove the Link entirely if no top branding is needed */}
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white mb-8 block">
          {/* Removed the RecruitEdgeLogo component */}
          {/* You can add text here if you want a text-based logo, e.g., "Candidate Portal" */}
        </Link>
        <nav className="space-y-4">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 text-gray-900 dark:text-white px-3 py-2 rounded-lg transition ${
                pathname === link.href ? 'bg-purple-100 dark:bg-zinc-800' : 'hover:bg-purple-50 dark:hover:bg-zinc-800/60'
              }`}
            >
              {link.icon}
              {link.name}
            </Link>
          ))}
        </nav>
      </div>

      <button
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
        onClick={() => {
          logout();
          router.push('/');
        }}
      >
        <LogOut size={18} /> Logout
      </button>
    </aside>
  );
}

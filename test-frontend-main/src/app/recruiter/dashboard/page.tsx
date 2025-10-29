'use client';

import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { Users, ClipboardList, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRecruiter } from '@/hooks/useRecruiter'; // mock for now
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RecruiterDashboardPage() {
  const { name } = useRecruiter(); // returns recruiter info from mock or auth
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'recruiter') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== 'recruiter') {
    return null;
  }

  return (
    <RecruiterLayout>
      <section className="space-y-8 bg-white dark:bg-zinc-900 p-6 rounded-xl min-h-screen transition-colors duration-300">
        {/* Welcome Box */}
        <div className="glass rounded-2xl p-6 shadow text-gray-900 dark:text-white">
          <h1 className="text-3xl font-bold mb-1">Welcome, {name} 💼</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Manage your hiring pipeline and talent acquisition</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass hover:scale-[1.02] transition-transform duration-300 p-6 rounded-xl text-gray-900 dark:text-white shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Candidates in Pipeline</span>
              <Users size={20} className="text-teal-400" />
            </div>
            <h2 className="text-2xl font-semibold">128</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active this week</p>
          </div>
          <div className="glass hover:scale-[1.02] transition-transform duration-300 p-6 rounded-xl text-gray-900 dark:text-white shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Open Requisitions</span>
              <ClipboardList size={20} className="text-orange-400" />
            </div>
            <h2 className="text-2xl font-semibold">12</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">This month</p>
          </div>
          {/* <div className="glass hover:scale-[1.02] transition-transform duration-300 p-6 rounded-xl text-white shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/70">Hiring Velocity</span>
              <TrendingUp size={20} className="text-lime-400" />
            </div>
            <h2 className="text-2xl font-semibold">+8%</h2>
            <p className="text-xs text-white/60">MoM Growth</p>
          </div> */}
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/recruiter/requisitions"
            className="glass hover:scale-[1.02] transition-transform duration-300 p-6 rounded-xl text-gray-900 dark:text-white hover:ring-2 hover:ring-purple-500 shadow"
          >
            <h3 className="text-xl font-semibold mb-2">📄 Requisitions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">View and manage all job openings</p>
          </Link>
          <Link
            href="/recruiter/candidates"
            className="glass hover:scale-[1.02] transition-transform duration-300 p-6 rounded-xl text-gray-900 dark:text-white hover:ring-2 hover:ring-purple-500 shadow"
          >
            <h3 className="text-xl font-semibold mb-2">🧑‍💼 Candidates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Track applications and candidate profiles</p>
          </Link>
        </div>
      </section>
    </RecruiterLayout>
  );
}

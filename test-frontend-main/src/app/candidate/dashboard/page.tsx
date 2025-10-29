'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link'; // Import Link for navigation
import CandidateLayout from '@/components/layout/CandidateLayout'; // Import the new layout

export default function CandidateDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'candidate') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== 'candidate') {
    return null;
  }

  return (
    <CandidateLayout> {/* Wrap content with CandidateLayout */}
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome, {user.name} 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Manage your job applications and profile
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* KPI Cards adjusted for consistent text color */}
            <div className="glass p-6 rounded-xl text-gray-900 dark:text-white shadow">
              <h3 className="text-lg font-semibold mb-2">Applications</h3>
              <p className="text-3xl font-bold">12</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Active applications</p>
            </div>
            <div className="glass p-6 rounded-xl text-gray-900 dark:text-white shadow">
              <h3 className="text-lg font-semibold mb-2">Interviews</h3>
              <p className="text-3xl font-bold">3</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Scheduled interviews</p>
            </div>
            <div className="glass p-6 rounded-xl text-gray-900 dark:text-white shadow">
              <h3 className="text-lg font-semibold mb-2">Saved Jobs</h3>
              <p className="text-3xl font-bold">8</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Bookmarked positions</p>
            </div>
          </div>
          <div className="glass p-6 rounded-xl">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> {/* Changed to 3 columns for new button */}
              <Link href="/candidate/jobs" passHref>
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors w-full">
                  Browse Jobs
                </button>
              </Link>
              <Link href="/candidate/resume-builder" passHref> {/* New button for Resume Builder */}
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors w-full">
                  Resume Builder
                </button>
              </Link>
              <Link href="/candidate/profile" passHref>
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors w-full">
                  Update Profile
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
}

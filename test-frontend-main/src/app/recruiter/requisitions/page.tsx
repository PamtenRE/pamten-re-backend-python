// src/app/recruiter/requisitions/page.tsx
'use client';

import { useState, useEffect } from 'react';
import RequisitionCard from '@/components/recruiter/RequisitionCard';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { mockJobApi, Job } from '@/lib/mockJobApi';
import Link from 'next/link';

type RequisitionStatus = 'Open' | 'Closed' | 'In Review';

// Extend the API Job with UI-only fields we use on the list
type UIJob = Job & {
  status: RequisitionStatus;
  applicants: number;
};

export default function RequisitionListPage() {
  const [filter, setFilter] = useState<RequisitionStatus | 'All'>('All');
  const [jobs, setJobs] = useState<UIJob[]>([]);
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    if (user?.role !== 'recruiter') {
      router.push('/');
      return;
    }

    const fetchJobs = async () => {
      try {
        const fetchedJobs = await mockJobApi.getJobs();
        // Map API jobs to our UIJob shape
        const formattedJobs: UIJob[] = fetchedJobs.map((job) => ({
          ...job,
          status: 'Open', // default for mock
          applicants: Math.floor(Math.random() * 50) + 1, // mock applicants
        }));
        setJobs(formattedJobs);
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      }
    };

    fetchJobs();
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== 'recruiter') {
    return null;
  }

  const filtered =
    filter === 'All'
      ? jobs
      : jobs.filter((job) => job.status === filter);

  return (
    <RecruiterLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Requisitions</h1>
          <Link href="/recruiter/requisitions/new" className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
            + New Requisition
          </Link>
        </div>

        <div className="flex gap-4 mb-6">
          {(['All', 'Open', 'Closed', 'In Review'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1 rounded-full text-sm border hover:bg-white hover:text-black transition ${
                filter === s ? 'bg-white text-black' : 'bg-transparent text-white border-white/40'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((req) => (
            <RequisitionCard key={req.id} {...req} id={req.id} />
          ))}
          {filtered.length === 0 && <p className="text-gray-400">No requisitions found.</p>}
        </div>
      </div>
    </RecruiterLayout>
  );
}

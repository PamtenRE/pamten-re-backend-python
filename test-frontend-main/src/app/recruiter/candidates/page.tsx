// src/app/recruiter/candidates/page.tsx
'use client';

import { useState } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import CandidateCard from '@/components/recruiter/CandidateCard';

const mockCandidates = [
  {
    id: '1',
    name: 'Jane Doe',
    role: 'Frontend Developer',
    status: 'Shortlisted',
    location: 'New York',
    experience: '3 years'
  },
  {
    id: '2',
    name: 'John Smith',
    role: 'Backend Developer',
    status: 'Interviewed',
    location: 'San Francisco',
    experience: '5 years'
  },
  {
    id: '3',
    name: 'Alice Johnson',
    role: 'Frontend Developer',
    status: 'Applied',
    location: 'Remote',
    experience: '2 years'
  },
];

const statusOptions = ['All', 'Shortlisted', 'Interviewed', 'Applied'];
const roleOptions = ['All', 'Frontend Developer', 'Backend Developer'];

export default function CandidateListPage() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

  const filteredCandidates = mockCandidates.filter(candidate => {
    const statusMatch = statusFilter === 'All' || candidate.status === statusFilter;
    const roleMatch = roleFilter === 'All' || candidate.role === roleFilter;
    return statusMatch && roleMatch;
  });

  return (
    <RecruiterLayout>
      <div className="flex flex-col gap-6">
        <div className="glass p-4 rounded-xl flex flex-wrap gap-4 items-center">
          <label className="text-sm text-gray-900 dark:text-white">
            Status:
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-2 p-2 rounded bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700"
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-900 dark:text-white">
            Role:
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="ml-2 p-2 rounded bg-white dark:bg-zinc-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700"
            >
              {roleOptions.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map(candidate => (
            <div key={candidate.id} className="glass rounded-xl p-4 hover:scale-[1.02] transition-all duration-300">
              <CandidateCard candidate={candidate} />
            </div>
          ))}
        </div>
      </div>
    </RecruiterLayout>
  );
}


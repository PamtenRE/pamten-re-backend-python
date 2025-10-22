// src/app/recruiter/applications/page.tsx
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import RecruiterLayout from '@/components/layout/RecruiterLayout';

const mockApplications = [
  {
    id: 1,
    name: 'Aarav Mehta',
    role: 'Frontend Developer',
    status: 'In Review',
  },
  {
    id: 2,
    name: 'Sara Iqbal',
    role: 'Data Analyst',
    status: 'Interviewed',
  },
  {
    id: 3,
    name: 'Kunal Roy',
    role: 'Backend Engineer',
    status: 'Hired',
  },
  {
    id: 4,
    name: 'Megha Patel',
    role: 'UI/UX Designer',
    status: 'In Review',
  },
];

const filters = ['All', 'In Review', 'Interviewed', 'Hired'];

export default function ApplicationsPage() {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredApps = mockApplications
    .filter((app) =>
      selectedFilter === 'All' ? true : app.status === selectedFilter
    )
    .filter((app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <RecruiterLayout>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">📋 Applications</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {filters.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedFilter(status)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedFilter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-black'
              }`}
            >
              {status}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1 rounded-md text-sm bg-white text-black border border-gray-300"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <Link
            href={`/recruiter/applications/${app.id}`}
            key={app.id}
            className="glass p-6 rounded-xl text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition"
          >
            <h3 className="text-lg font-semibold">{app.name}</h3>
            <p className="text-muted text-sm">{app.role}</p>
            <span
              className={`inline-block mt-2 px-3 py-1 rounded-full text-xs ${
                app.status === 'In Review'
                  ? 'bg-yellow-500'
                  : app.status === 'Interviewed'
                  ? 'bg-blue-500'
                  : 'bg-green-500'
              }`}
            >
              {app.status}
            </span>
          </Link>
        ))}
      </div>
    </RecruiterLayout>
  );
}


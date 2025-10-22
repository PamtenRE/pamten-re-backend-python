// src/app/candidate/jobs/page.tsx
'use client';

import { motion } from 'framer-motion';
import { MapPin, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { mockJobApi, Job } from '@/lib/mockJobApi'; // Import mock API and Job type

export default function JobListingsPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState<Job[]>([]); // Store all fetched jobs
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]); // Store filtered jobs
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-candidates or unauthenticated users
    if (!isAuthenticated || user?.role !== 'candidate') {
      router.push('/');
      return;
    }

    const fetchJobs = async () => {
      setLoading(true);
      try {
        const jobsData = await mockJobApi.getJobs();
        setAllJobs(jobsData);
        setFilteredJobs(jobsData); // Initially show all jobs
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
        // Optionally, show an error message to the user
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const newFilteredJobs = allJobs.filter(job =>
      job.title.toLowerCase().includes(lowercasedSearchTerm) ||
      job.company.toLowerCase().includes(lowercasedSearchTerm) ||
      job.location.toLowerCase().includes(lowercasedSearchTerm)
    );
    setFilteredJobs(newFilteredJobs);
  }, [searchTerm, allJobs]); // Re-filter when searchTerm or allJobs change

  if (!isAuthenticated || user?.role !== 'candidate') {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-neutral-900 flex items-center justify-center text-white text-xl">
        Loading available jobs...
      </div>
    );
  }

  return (
    <section className="min-h-screen p-6 bg-gradient-to-b from-black to-neutral-900 text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">Browse All Jobs</h1>
        
        <div className="mb-8 flex justify-center">
          <input
            type="text"
            placeholder="Search jobs by title, company, or location..."
            className="w-full max-w-lg p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredJobs.length === 0 ? (
          <p className="text-center text-gray-400 text-lg">No jobs found matching your search criteria.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="glass rounded-2xl p-6 shadow-md hover:shadow-purple-500/30 transition-all duration-300"
              >
                <div className="flex items-center gap-4 mb-3 text-white text-xl">
                  <span className="text-2xl">{job.emoji}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <p className="text-sm text-zinc-300">{job.company}</p>
                  </div>
                </div>

                <div className="text-sm text-zinc-300 flex flex-col gap-1">
                  <p className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {job.location}
                  </p>
                  <p className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> {job.salary}
                  </p>
                </div>

                <Link
                  href={`/candidate/jobs/${job.id}`}
                  className="mt-4 w-full block text-center bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 rounded transition"
                >
                  View Details
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


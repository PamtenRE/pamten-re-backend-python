// src/app/candidate/jobs/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { MapPin, DollarSign, Briefcase, Clock, FileText } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { mockJobApi, Job } from '@/lib/mockJobApi'; // Import mock API and Job type
import Link from 'next/link';

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'candidate') {
      router.push('/');
      return;
    }

    const fetchJobDetails = async () => {
      setLoading(true);
      try {
        if (id) {
          const fetchedJob = await mockJobApi.getJobById(id as string);
          if (fetchedJob) {
            setJob(fetchedJob);
          } else {
            router.push('/candidate/jobs'); // Redirect if job not found
          }
        }
      } catch (error) {
        console.error('Failed to fetch job details:', error);
        setSubmitError('Failed to load job details.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [id, isAuthenticated, user, router]);

  const handleResumeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setResume(event.target.files[0]);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setIsSubmitting(true);

    if (!resume) {
      setSubmitError('Please upload your resume.');
      setIsSubmitting(false);
      return;
    }

    // Mock API call for application submission
    try {
      console.log('Submitting application for job:', job?.title);
      console.log('Resume:', resume.name);
      console.log('Cover Letter:', coverLetter);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In a real application, you'd send this data to a backend API
      // const formData = new FormData();
      // formData.append('jobId', job.id.toString());
      // formData.append('candidateId', user.id);
      // formData.append('resume', resume);
      // formData.append('coverLetter', coverLetter);
      // const response = await fetch('/api/applications/apply', { method: 'POST', body: formData });
      // const result = await response.json();
      // if (!response.ok) throw new Error(result.message || 'Application failed');

      setSubmitSuccess(true);
      setCoverLetter('');
      setResume(null);
      // Optionally redirect to a confirmation page or dashboard
      // router.push('/candidate/dashboard?applicationSuccess=true');
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to submit application.');
      console.error('Application submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-neutral-900 flex items-center justify-center text-white text-xl">
        Loading job details...
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-neutral-900 flex items-center justify-center text-red-400 text-xl">
        Job not found.
      </div>
    );
  }

  return (
    <section className="min-h-screen p-6 bg-gradient-to-b from-black to-neutral-900 text-white">
      <div className="max-w-4xl mx-auto glass rounded-2xl shadow-xl p-8 space-y-8">
        <Link href="/candidate/jobs" className="text-purple-400 hover:underline mb-4 block">
          ← Back to All Jobs
        </Link>

        {/* Job Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="pb-4 border-b border-white/20"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="text-4xl">{job.emoji}</span> {job.title}
          </h1>
          <p className="text-xl text-zinc-300 mb-2">{job.company}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">
            <p className="flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {job.location}
            </p>
            <p className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> {job.salary}
            </p>
            <p className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" /> {job.employmentType}
            </p>
            <p className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> Posted: {job.postedDate}
            </p>
          </div>
        </motion.div>

        {/* Job Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-2xl font-semibold mb-3">Job Description</h2>
          <p className="text-zinc-300 leading-relaxed">{job.description}</p>
        </motion.div>

        {/* Requirements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-semibold mb-3">Requirements</h2>
          <ul className="list-disc list-inside text-zinc-300 space-y-1">
            {job.requirements.map((req, index) => (
              <li key={index}>{req}</li>
            ))}
          </ul>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-2xl font-semibold mb-3">Benefits</h2>
          <ul className="list-disc list-inside text-zinc-300 space-y-1">
            {job.benefits.map((benefit, index) => (
              <li key={index}>{benefit}</li>
            ))}
          </ul>
        </motion.div>

        {/* Application Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white/5 p-6 rounded-xl border border-white/20"
        >
          <h2 className="text-2xl font-semibold mb-4">Apply for this Job</h2>
          <form onSubmit={handleApply} className="space-y-4">
            <div>
              <label htmlFor="resume" className="block text-sm font-medium text-zinc-200 mb-2">
                Upload Resume (PDF only)
              </label>
              <input
                type="file"
                id="resume"
                name="resume"
                accept=".pdf"
                onChange={handleResumeUpload}
                className="block w-full text-sm text-zinc-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-purple-50 file:text-purple-700
                  hover:file:bg-purple-100
                  cursor-pointer
                "
                required
              />
              {resume && <p className="text-sm text-zinc-400 mt-2">Selected file: {resume.name}</p>}
            </div>

            <div>
              <label htmlFor="coverLetter" className="block text-sm font-medium text-zinc-200 mb-2">
                Cover Letter (Optional)
              </label>
              <textarea
                id="coverLetter"
                name="coverLetter"
                rows={5}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell us why you're a great fit for this role..."
                className="w-full p-3 rounded-md bg-black/30 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              ></textarea>
            </div>

            {submitError && (
              <p className="text-red-400 text-sm">{submitError}</p>
            )}
            {submitSuccess && (
              <p className="text-green-400 text-sm">Application submitted successfully! We will get back to you soon.</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                isSubmitting
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white flex items-center justify-center gap-2`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" /> Submit Application
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}


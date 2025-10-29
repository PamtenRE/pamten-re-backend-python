// src/app/recruiter/requisitions/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useParams } from 'next/navigation';
import { mockJobApi, Job } from '@/lib/mockJobApi';

export default function RequisitionDetailPage() {
  // Strongly type the route param
  const params = useParams<{ id: string }>();
  const id = params?.id;

  // Allow null in state so we can represent "not found"
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) {
        setJob(null);
        setLoading(false);
        return;
      }
      try {
        const fetchedJob = await mockJobApi.getJobById(id as string);
        // ✅ Coalesce undefined → null to satisfy Job | null
        setJob(fetchedJob ?? null);
      } catch (e) {
        console.error('Failed to load job:', e);
        setJob(null);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  if (loading) {
    return (
      <RecruiterLayout>
        <div className="min-h-screen p-6 text-white flex items-center justify-center">
          Loading requisition details...
        </div>
      </RecruiterLayout>
    );
  }

  if (!job) {
    return (
      <RecruiterLayout>
        <div className="min-h-screen p-6 text-white flex items-center justify-center">
          Requisition not found.
        </div>
      </RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout>
      <div className="max-w-4xl mx-auto glass p-6 rounded-xl text-white space-y-6">
        <div>
          <h1 className="text-3xl font-bold">✨ {job.title}</h1>
          <p className="text-muted text-sm">
            Company: {job.company} • Location: {job.location}
          </p>
          <p className="text-xs text-purple-400 mt-2">Status: Open</p>
        </div>

        {job.description && (
          <div>
            <h2 className="font-semibold mb-2">📝 Job Description</h2>
            <p className="text-sm text-muted whitespace-pre-wrap">{job.description}</p>
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-2">📋 Requirements</h2>
          {job.requirements?.length ? (
            <ul className="list-disc list-inside text-sm text-muted">
              {job.requirements.map((req, index) => (
                <li key={index}>{req}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No specific requirements listed.</p>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2">🌟 Benefits</h2>
          {job.benefits?.length ? (
            <ul className="list-disc list-inside text-sm text-muted">
              {job.benefits.map((benefit, index) => (
                <li key={index}>{benefit}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Benefits not provided.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass p-4 rounded-md">
            <p className="text-muted text-sm">Applicants</p>
            <p className="text-2xl font-bold">23</p>
          </div>
          <div className="glass p-4 rounded-md">
            <p className="text-muted text-sm">Interviews</p>
            <p className="text-2xl font-bold">8</p>
          </div>
          <div className="glass p-4 rounded-md">
            <p className="text-muted text-sm">Offers Made</p>
            <p className="text-2xl font-bold">2</p>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white">
            ✏️ Edit
          </button>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white">
            🗑️ Archive
          </button>
        </div>
      </div>
    </RecruiterLayout>
  );
}

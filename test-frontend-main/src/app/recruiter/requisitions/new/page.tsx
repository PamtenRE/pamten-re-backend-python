// src/app/recruiter/requisitions/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';

export default function NewRequisitionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    type: 'Full-time',
    description: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Requisition created:', formData);
    // TODO: Integrate API call here
    router.push('/recruiter/requisitions');
  };

  return (
    <RecruiterLayout>
    <div className="min-h-screen p-8 bg-gradient-to-b from-black to-neutral-900 text-white">
      <h1 className="text-3xl font-bold mb-6">📝 Create New Requisition</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div>
          <label className="block mb-1 text-sm font-medium">Job Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="w-full p-3 rounded-md bg-black bg-opacity-30 border border-white/10"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Department</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full p-3 rounded-md bg-black bg-opacity-30 border border-white/10"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              className="w-full p-3 rounded-md bg-black bg-opacity-30 border border-white/10"
            />
          </div>
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Employment Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full p-3 rounded-md bg-black bg-opacity-30 border border-white/10"
          >
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium">Job Description</label>
          <textarea
            name="description"
            rows={5}
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full p-3 rounded-md bg-black bg-opacity-30 border border-white/10"
          ></textarea>
        </div>
        <button
          type="submit"
          className="bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 transition"
        >
          Create Requisition
        </button>
      </form>
    </div>
    </RecruiterLayout>
  );
}

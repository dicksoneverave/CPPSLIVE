import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useRouter } from 'next/router';

const DecisionPrescreeningReview = () => {
  const { session, profile, group, loading, signIn, signOut } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    IRN: '',
    PRSubmissionDate: '',
    PRFormType: '',
    PRID: '',
    WorkerFirstName: '',
    WorkerLastName: '',
    ApprovalStatus: ''
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Simulate form submission
      toast.success('Form submitted successfully!');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Error submitting form.');
    }
  };

  return (
    <div className="bg-background p-8 rounded-lg shadow-md max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Decision Prescreening Review</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="IRN" className="block text-sm font-medium text-textSecondary">
            IRN
          </label>
          <input
            type="text"
            id="IRN"
            name="IRN"
            value={formData.IRN}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="PRSubmissionDate" className="block text-sm font-medium text-textSecondary">
            PR Submission Date
          </label>
          <input
            type="date"
            id="PRSubmissionDate"
            name="PRSubmissionDate"
            value={formData.PRSubmissionDate}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="PRFormType" className="block text-sm font-medium text-textSecondary">
            PR Form Type
          </label>
          <input
            type="text"
            id="PRFormType"
            name="PRFormType"
            value={formData.PRFormType}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="PRID" className="block text-sm font-medium text-textSecondary">
            PR ID
          </label>
          <input
            type="text"
            id="PRID"
            name="PRID"
            value={formData.PRID}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="WorkerFirstName" className="block text-sm font-medium text-textSecondary">
            Worker First Name
          </label>
          <input
            type="text"
            id="WorkerFirstName"
            name="WorkerFirstName"
            value={formData.WorkerFirstName}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="WorkerLastName" className="block text-sm font-medium text-textSecondary">
            Worker Last Name
          </label>
          <input
            type="text"
            id="WorkerLastName"
            name="WorkerLastName"
            value={formData.WorkerLastName}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="ApprovalStatus" className="block text-sm font-medium text-textSecondary">
            Approval Status
          </label>
          <select
            id="ApprovalStatus"
            name="ApprovalStatus"
            value={formData.ApprovalStatus}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          >
            <option value="">Select Status</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          Submit
        </button>
      </form>
    </div>
  );
};

export default DecisionPrescreeningReview;

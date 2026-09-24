/**
 * Proposal Input Component
 *
 * Interface for submitting project proposals to the CEO
 */

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAppStore } from '@/store';
import { websocketService } from '@/services/websocket';

export function ProposalInput() {
  const [proposal, setProposal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const connectionInfo = useAppStore((state) => state.connectionInfo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proposal.trim() || !connectionInfo.connected || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      websocketService.submitProposal(proposal.trim());

      setProposal('');
    } catch (error) {
      console.error('Failed to submit proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
      <form onSubmit={handleSubmit} className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl">
        <div className="p-4">
          <label htmlFor="proposal" className="block text-sm font-medium text-gray-300 mb-2">
            Submit Project Proposal to CEO
          </label>
          <div className="flex gap-2">
            <textarea
              id="proposal"
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
              placeholder="Describe your project idea (e.g., 'Build a real-time chat application with authentication')..."
              disabled={!connectionInfo.connected || isSubmitting}
              rows={3}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
            <button
              type="submit"
              disabled={!proposal.trim() || !connectionInfo.connected || isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center gap-2 self-end"
            >
              <Send size={18} />
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              The CEO will evaluate feasibility and delegate tasks to the team
            </span>
            <span className={`font-medium ${connectionInfo.connected ? 'text-green-400' : 'text-red-400'}`}>
              {connectionInfo.connected ? '● Connected' : '● Disconnected'}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}

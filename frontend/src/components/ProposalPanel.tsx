/**
 * Proposal Input Panel Component
 */

import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store';

export function ProposalPanel() {
  const [proposal, setProposal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!proposal.trim()) return;

    setIsSubmitting(true);

    // TODO: Send to backend via WebSocket
    console.log('Submitting proposal:', proposal);

    // Simulate API call
    setTimeout(() => {
      setProposal('');
      setIsSubmitting(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="absolute bottom-8 left-8 w-96 bg-slate-900/90 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-semibold">New Project Proposal</h2>
        </div>
        <p className="text-slate-400 text-xs mt-1">
          Describe your project and let the AI agents handle it
        </p>
      </div>

      {/* Input area */}
      <div className="p-6">
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Example: Create a modern landing page for a SaaS product with hero section, features, pricing, and contact form..."
          className="w-full h-32 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
          disabled={isSubmitting}
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!proposal.trim() || isSubmitting}
          className="mt-4 w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit to CEO</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

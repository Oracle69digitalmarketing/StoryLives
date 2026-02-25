import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StoryChunk } from '../types';
import { Sparkles } from 'lucide-react';

interface StoryCanvasProps {
  chunk: StoryChunk | null;
  onChoice: (choice: string) => void;
  isProcessing: boolean;
}

export const StoryCanvas: React.FC<StoryCanvasProps> = ({ chunk, onChoice, isProcessing }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (chunk) {
      let i = 0;
      setDisplayedText('');
      setIsTyping(true);
      const text = chunk.narration;
      
      const interval = setInterval(() => {
        setDisplayedText((prev) => prev + text[i]);
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [chunk]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {chunk && (
          <motion.div
            key={chunk.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <Sparkles size={20} />
              <span className="text-xs uppercase tracking-widest font-semibold">The Story Unfolds</span>
            </div>

            <div className="text-xl md:text-2xl text-white font-serif leading-relaxed min-h-[120px]">
              {displayedText}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="inline-block w-1 h-6 bg-emerald-400 ml-1 align-middle"
                />
              )}
            </div>

            {!isTyping && chunk.choices && chunk.choices.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 flex flex-wrap gap-3"
              >
                {chunk.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    disabled={isProcessing}
                    onClick={() => onChoice(choice)}
                    className="px-6 py-3 bg-white/10 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 text-white rounded-full transition-all duration-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {choice}
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {isProcessing && !isTyping && (
        <div className="mt-4 flex justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-emerald-400/60 text-xs font-mono uppercase tracking-widest"
          >
            Lumi is thinking...
          </motion.div>
        </div>
      )}
    </div>
  );
};

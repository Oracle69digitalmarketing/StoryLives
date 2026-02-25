import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface VoiceButtonProps {
  onVoiceInput: (text: string) => void;
  isProcessing: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onVoiceInput, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        // In a real app, we'd send this to an STT service.
        // For this demo, we'll simulate STT or use a placeholder.
        // Since I don't have a direct STT tool in the prompt (other than Gemini itself),
        // I'll use the Web Speech API if available, or just simulate it for now.
        
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          onVoiceInput(text);
        };
        recognition.start();
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`relative h-20 w-20 rounded-full flex items-center justify-center transition-colors shadow-lg ${
          isRecording 
            ? 'bg-red-500 text-white' 
            : 'bg-emerald-500 text-white hover:bg-emerald-400'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={32} />
        ) : isRecording ? (
          <Square size={32} fill="currentColor" />
        ) : (
          <Mic size={32} />
        )}
        
        {isRecording && (
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute inset-0 rounded-full bg-red-500"
          />
        )}
      </motion.button>
      <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">
        {isProcessing ? 'Lumi is listening...' : isRecording ? 'Recording...' : 'Hold to Talk to Lumi'}
      </p>
    </div>
  );
};

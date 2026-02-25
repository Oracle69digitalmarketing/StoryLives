/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { StoryCanvas } from './components/StoryCanvas';
import { ImageGallery } from './components/ImageGallery';
import { VoiceButton } from './components/VoiceButton';
import { DrawingPad } from './components/DrawingPad';
import { StoryChunk } from './types';
import { 
  BookOpen, Volume2, VolumeX, Sparkles, RefreshCw, 
  PenTool, Video, Wand2, Loader2, AlertCircle 
} from 'lucide-react';

const SYSTEM_PROMPT = `You are Lumi, a warm, magical storyteller for children aged 5-9.
You are in a LIVE conversation. You can hear the child and respond instantly.

CRITICAL RULES:
1. Always respond in valid JSON format for story updates.
2. Keep narration to 2-3 sentences per chunk.
3. End each chunk with a question or choice.
4. Use simple, vivid language.
5. If the child draws something, comment on it warmly!
6. You can be interrupted! If the child speaks, stop and listen.

Output format for story updates:
{
"narration": "text here",
"image_prompt": "detailed description for illustration",
"choices": ["choice a", "choice b"],
"story_state": {
"location": "current setting",
"characters": ["list of characters"],
"mood": "happy/excited/curious"
}
}`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narration: { type: Type.STRING },
    image_prompt: { type: Type.STRING },
    choices: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    story_state: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING },
        characters: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        mood: { type: Type.STRING }
      },
      required: ["location", "characters", "mood"]
    }
  },
  required: ["narration", "image_prompt", "choices", "story_state"]
};

export default function App() {
  const [currentChunk, setCurrentChunk] = useState<StoryChunk | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVideoGenerating, setIsVideoGenerating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showDrawingPad, setShowDrawingPad] = useState(false);
  const [sessionId] = useState(() => `session_${Math.random().toString(36).substr(2, 9)}`);
  
  const socket = useRef<Socket | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const ai = useRef<any>(null);
  const liveSession = useRef<any>(null);

  useEffect(() => {
    ai.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    // Connect to backend for session sync
    socket.current = io();
    socket.current.emit('join_session', sessionId);
    
    socket.current.on('session_joined', (data) => {
      if (data.history.length === 0) {
        startNewStory();
      }
    });

    // Initialize Live API
    setupLiveSession();

    return () => {
      socket.current?.disconnect();
      liveSession.current?.close();
    };
  }, []);

  const setupLiveSession = async () => {
    try {
      const session = await ai.current.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: SYSTEM_PROMPT,
        },
        callbacks: {
          onopen: () => console.log("Live session opened"),
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
              playLiveAudio(base64Audio);
            }
            if (message.serverContent?.interrupted) {
              stopAudioPlayback();
            }
          },
          onerror: (err: any) => console.error("Live session error:", err),
          onclose: () => console.log("Live session closed"),
        },
      });
      liveSession.current = session;
    } catch (err) {
      console.error("Failed to connect to Live API:", err);
    }
  };

  const playLiveAudio = async (base64Audio: string) => {
    if (isMuted) return;
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer;
    const audioBuffer = await audioContext.current.decodeAudioData(audioData);
    const source = audioContext.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.current.destination);
    source.start();
  };

  const stopAudioPlayback = () => {
    // Logic to stop current audio source if needed
  };

  const startNewStory = async () => {
    setIsProcessing(true);
    setImages([]);
    setVideoUrl(null);
    
    try {
      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: "Start a new story adventure!" }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const chunk = JSON.parse(response.text);
      chunk.id = Date.now().toString();
      setCurrentChunk(chunk);
      
      generateImage(chunk.image_prompt);
      
    } catch (error) {
      console.error("Error starting story:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInput = async (input: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: input }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const chunk = JSON.parse(response.text);
      chunk.id = Date.now().toString();
      setCurrentChunk(chunk);
      
      generateImage(chunk.image_prompt);

    } catch (error) {
      console.error("Error continuing story:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateImage = async (prompt: string) => {
    try {
      const response = await ai.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: `A magical children's book illustration: ${prompt}` }],
        },
        config: {
          imageConfig: { aspectRatio: "16:9" },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setImages(prev => [...prev, imageUrl]);
          break;
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
    }
  };

  const generateMagicVideo = async () => {
    if (!currentChunk || isVideoGenerating) return;
    setIsVideoGenerating(true);
    setVideoUrl(null);

    try {
      // Check for API key selection for Veo
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
      }

      const veoAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      let operation = await veoAi.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A magical, animated scene of: ${currentChunk.image_prompt}. Whimsical children's animation style.`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await veoAi.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.error("Error generating video:", error);
    } finally {
      setIsVideoGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-white font-sans selection:bg-emerald-500/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex justify-between items-center border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <BookOpen className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">StoryLives</h1>
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono">Lumi: Your Live Story Friend</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={generateMagicVideo}
            disabled={isVideoGenerating || !currentChunk}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full text-xs font-medium text-amber-400 transition-all disabled:opacity-50"
          >
            {isVideoGenerating ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            Magic Video
          </button>
          <button 
            onClick={() => setShowDrawingPad(!showDrawingPad)}
            className={`p-2 rounded-full transition-colors ${showDrawingPad ? 'bg-emerald-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <PenTool size={20} />
          </button>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/60 hover:text-white"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={startNewStory}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-medium transition-all"
          >
            <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
            Reset
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left Side: Visuals & Drawing */}
        <section className="space-y-8 lg:sticky lg:top-24">
          <AnimatePresence mode="wait">
            {videoUrl ? (
              <motion.div
                key="video"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-video w-full overflow-hidden rounded-3xl bg-black border border-amber-500/30 shadow-2xl"
              >
                <video src={videoUrl} autoPlay loop controls className="h-full w-full object-cover" />
                <button 
                  onClick={() => setVideoUrl(null)}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black rounded-full text-white/60 hover:text-white transition-colors"
                >
                  <AlertCircle size={20} />
                </button>
              </motion.div>
            ) : showDrawingPad ? (
              <motion.div
                key="drawing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DrawingPad />
              </motion.div>
            ) : (
              <motion.div
                key="gallery"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <ImageGallery images={images} currentPrompt={currentChunk?.image_prompt} />
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Place</p>
              <p className="text-sm font-medium text-emerald-400 truncate">{currentChunk?.story_state.location || '...'}</p>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Friends</p>
              <p className="text-sm font-medium text-blue-400 truncate">{currentChunk?.story_state.characters.join(', ') || '...'}</p>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Feeling</p>
              <p className="text-sm font-medium text-amber-400 truncate">{currentChunk?.story_state.mood || '...'}</p>
            </div>
          </div>
        </section>

        {/* Right Side: Story & Interaction */}
        <section className="space-y-12">
          <StoryCanvas 
            chunk={currentChunk} 
            onChoice={handleInput} 
            isProcessing={isProcessing} 
          />

          <div className="flex flex-col items-center gap-8 pt-8">
            <VoiceButton onVoiceInput={handleInput} isProcessing={isProcessing} />
            
            <div className="w-full max-w-md">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Tell Lumi what happens next..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      handleInput(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-white/20"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20">
                  <Sparkles size={16} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 p-8 text-center text-white/10 text-[10px] uppercase tracking-[0.3em] font-mono">
        StoryLives &bull; Lumi Live AI Storyteller
      </footer>
    </div>
  );
}

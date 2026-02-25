import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon } from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  currentPrompt?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, currentPrompt }) => {
  return (
    <div className="w-full">
      <div className="relative aspect-square md:aspect-video w-full overflow-hidden rounded-3xl bg-black/40 border border-white/10 shadow-2xl">
        <AnimatePresence mode="wait">
          {images.length > 0 ? (
            <motion.img
              key={images[images.length - 1]}
              src={images[images.length - 1]}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1 }}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-white/20">
              <ImageIcon size={64} strokeWidth={1} />
              <p className="mt-4 text-sm font-mono uppercase tracking-widest">Awaiting Illustration</p>
            </div>
          )}
        </AnimatePresence>
        
        {currentPrompt && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <p className="text-xs text-white/60 font-mono italic truncate">
              {currentPrompt}
            </p>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {images.slice(0, -1).reverse().map((img, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/10"
            >
              <img src={img} className="h-full w-full object-cover opacity-60 hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

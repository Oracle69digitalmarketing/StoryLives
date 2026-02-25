import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { Eraser, Pencil, Trash2 } from 'lucide-react';

export const DrawingPad: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
        width: 400,
        height: 300,
        backgroundColor: '#1a1a1a',
      });

      if (fabricCanvas.current.freeDrawingBrush) {
        fabricCanvas.current.freeDrawingBrush.width = 5;
        fabricCanvas.current.freeDrawingBrush.color = '#10b981'; // emerald-500
      }
    }

    return () => {
      fabricCanvas.current?.dispose();
    };
  }, []);

  const clearCanvas = () => {
    fabricCanvas.current?.clear();
    if (fabricCanvas.current) {
      fabricCanvas.current.backgroundColor = '#1a1a1a';
      fabricCanvas.current.renderAll();
    }
  };

  const toggleEraser = () => {
    if (fabricCanvas.current) {
      fabricCanvas.current.isDrawingMode = true;
      if (fabricCanvas.current.freeDrawingBrush) {
        fabricCanvas.current.freeDrawingBrush.color = '#1a1a1a';
        fabricCanvas.current.freeDrawingBrush.width = 20;
      }
    }
  };

  const togglePencil = () => {
    if (fabricCanvas.current) {
      fabricCanvas.current.isDrawingMode = true;
      if (fabricCanvas.current.freeDrawingBrush) {
        fabricCanvas.current.freeDrawingBrush.color = '#10b981';
        fabricCanvas.current.freeDrawingBrush.width = 5;
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-white/5 p-6 rounded-3xl border border-white/10">
      <div className="flex items-center justify-between w-full mb-2">
        <h3 className="text-xs font-mono uppercase tracking-widest text-white/40">Draw for Lumi</h3>
        <div className="flex gap-2">
          <button onClick={togglePencil} className="p-2 hover:bg-white/10 rounded-lg text-emerald-400 transition-colors">
            <Pencil size={18} />
          </button>
          <button onClick={toggleEraser} className="p-2 hover:bg-white/10 rounded-lg text-white/60 transition-colors">
            <Eraser size={18} />
          </button>
          <button onClick={clearCanvas} className="p-2 hover:bg-white/10 rounded-lg text-red-400 transition-colors">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden border border-white/20 shadow-inner">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

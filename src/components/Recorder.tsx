import React, { useState, useRef, useEffect } from 'react';
import { ProcessingStatus } from '../types';

interface RecorderProps {
  onComplete: (base64: string, mimeType: string) => void;
  status: ProcessingStatus;
}

export const Recorder: React.FC<RecorderProps> = ({ onComplete, status }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Math-generated simulation of live sound levels for visual parity with standard wave structures
  const [waveHeights, setWaveHeights] = useState<number[]>([30, 50, 40, 60, 45, 35, 55, 65, 50, 40, 30, 20]);

  useEffect(() => {
    let animId: any;
    if (isRecording) {
      const updateWave = () => {
        setWaveHeights(prev => prev.map(() => Math.floor(Math.random() * 60) + 15));
        animId = setTimeout(updateWave, 120);
      };
      updateWave();
    }
    return () => {
      if (animId) clearTimeout(animId);
    };
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          onComplete(base64data, 'audio/webm');
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6 py-2" id="audio-recorder-container">
      {isRecording ? (
        <div className="space-y-4">
          {/* Real-time Visualizer Panel from design draft */}
          <div className="h-40 bg-brand-primary rounded-[40px] flex items-center justify-center relative overflow-hidden shadow-xs">
            {/* Dynamic Sound Equalizer Simulation */}
            <div className="flex items-center gap-1.5 z-10">
              {waveHeights.map((height, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-white rounded-full transition-all duration-150" 
                  style={{ 
                    height: `${height}px`,
                    opacity: 0.3 + (height / 100)
                  }}
                />
              ))}
            </div>
            
            {/* Ambient Background Wave SVG */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%" viewBox="0 0 800 200" preserveAspectRatio="none">
                <path d="M0 100 C 200 50, 400 150, 800 100" stroke="white" fill="transparent" strokeWidth="4" />
              </svg>
            </div>

            {/* Dynamic visual parameters badge */}
            <div className="absolute bottom-4 right-8 flex items-center gap-2 text-white/80 text-[10px] font-mono uppercase tracking-widest">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              Live • {formatTime(recordingTime)}
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="text-xs text-brand-muted">
              Speaking into system receiver...
            </div>
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-brand-text text-white rounded-2xl font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
              id="stop-recording-button"
            >
              Stop Recording
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8 bg-[#FAF9F6] border border-brand-border border-dashed rounded-[30px]">
          <button
            onClick={startRecording}
            disabled={status === 'processing'}
            className="w-14 h-14 bg-white rounded-full border border-brand-border flex items-center justify-center text-brand-primary hover:bg-brand-subtle-green hover:text-brand-primary transition-all shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            id="start-recording-button"
            aria-label="Start recording speech"
          >
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <div className="text-center space-y-1">
            <p className="text-xs text-brand-text font-medium">Capture Session Audio</p>
            <p className="text-[10px] text-brand-muted">Uses high-sensitivity local mic input</p>
          </div>
        </div>
      )}
    </div>
  );
};

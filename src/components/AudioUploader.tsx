import React, { useRef } from 'react';
import { ProcessingStatus } from '../types';

interface AudioUploaderProps {
  onComplete: (base64: string, mimeType: string, filename: string) => void;
  status: ProcessingStatus;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onComplete, status }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Support iPhone audio (.m4a, .mp4, .aac)
    const allowedTypes = [
      'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/ogg', 'audio/webm',
      'audio/x-m4a', 'audio/aac', 'video/mp4' // iPhone recordings are sometimes tagged as video/mp4
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.m4a')) {
      alert("Unsupported file format. Please upload common audio formats like .m4a (iPhone), .mp3, or .wav.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onComplete(base64, file.type || 'audio/m4a', file.name);
    };
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8 bg-[#FAF9F6] border border-brand-border border-dashed rounded-[30px]" id="audio-uploader-container">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".mp3,.wav,.m4a,.aac,.mp4,.webm"
        className="hidden"
        id="audio-file-input"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={status === 'processing'}
        className="w-14 h-14 bg-white rounded-full border border-brand-border flex items-center justify-center text-brand-primary hover:bg-[#F0F2EE] hover:text-brand-primary transition-all shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        id="audio-select-button"
        aria-label="Select audio files"
      >
        <svg className="w-6 h-6 group-hover:scale-110 transition-transform text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </button>
      <div className="text-center space-y-1">
        <p className="text-xs text-brand-text font-medium">Click to select audio file</p>
        <p className="text-[10px] text-brand-muted">Supports raw wav, m4a, wav, or mp3 file types</p>
      </div>
    </div>
  );
};

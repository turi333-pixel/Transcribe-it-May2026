import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Recorder } from './components/Recorder';
import { AudioUploader } from './components/AudioUploader';
import { Editor } from './components/Editor';
import { TranscriptionItem, ProcessingStatus } from './types';
import { transcribeAudio } from './services/geminiService';

const App: React.FC = () => {
  const [history, setHistory] = useState<TranscriptionItem[]>([]);
  const [activeItem, setActiveItem] = useState<TranscriptionItem | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('transcribe_it_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('transcribe_it_history', JSON.stringify(history));
  }, [history]);

  const handleTranscriptionComplete = async (base64: string, mimeType: string, filename?: string) => {
    setStatus('processing');
    setUploadProgress(0);
    setError(null);
    
    try {
      const text = await transcribeAudio(base64, mimeType, filename, (progress) => {
        setUploadProgress(progress);
      });
      
      const newItem: TranscriptionItem = {
        id: crypto.randomUUID(),
        title: filename || `Session - ${new Date().toLocaleDateString()}`,
        content: text,
        date: Date.now(),
        status: 'draft'
      };

      setHistory(prev => [newItem, ...prev]);
      setActiveItem(newItem);
      setStatus('idle');
      setUploadProgress(null);
    } catch (err: any) {
      setError(err.message || "Something went wrong during transcription.");
      setStatus('error');
      setUploadProgress(null);
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<TranscriptionItem>) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    if (activeItem?.id === id) {
      setActiveItem(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleDeleteItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeItem?.id === id) {
      setActiveItem(null);
    }
  };

  const createNew = () => {
    setActiveItem(null);
    setStatus('idle');
    setIsSidebarOpen(false);
  };

  const selectItem = (item: TranscriptionItem) => {
    setActiveItem(item);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-brand-bg text-brand-text overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#3E362E]/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Drawer on mobile, fixed on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar 
          items={history} 
          activeId={activeItem?.id} 
          onSelect={selectItem} 
          onDelete={handleDeleteItem}
          onNew={createNew}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col min-w-0 relative h-full">
        {/* Editorial Top Navigation Header */}
        <header className="pt-4 sm:pt-0 h-[72px] sm:h-20 border-b border-brand-border bg-white flex items-center justify-between px-3 sm:px-6 md:px-10 shrink-0 select-none">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 sm:p-2 lg:hidden text-brand-muted hover:bg-brand-bg rounded-xl transition-colors cursor-pointer"
              aria-label="Open sidebar drawer"
            >
              <svg className="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h2 className="text-base sm:text-lg md:text-2xl font-light text-brand-text truncate max-w-[120px] sm:max-w-none">Active Transcription</h2>
              <p className="text-[10px] text-brand-muted hidden sm:block">Session live pipeline via TranscribeIT AI</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <select className="bg-white border border-brand-border rounded-full px-2 py-1 md:px-3 md:py-1.5 text-xs text-brand-primary focus:outline-none cursor-pointer">
              <option>EN</option>
              <option>ES</option>
              <option>FR</option>
              <option>DE</option>
            </select>
            {status === 'processing' && (
              <div className="flex items-center gap-1.5 text-brand-primary font-medium text-xs bg-brand-subtle-green px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-full border border-[#DCE4DB]" title="Processing...">
                <svg className="animate-spin h-3.5 w-3.5 text-brand-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden sm:inline">Processing...</span>
              </div>
            )}
          </div>
        </header>

        {/* Outer view page container */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 md:p-10 w-full max-w-5xl mx-auto flex flex-col justify-start">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-medium">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-900 hover:text-red-700 font-bold ml-4 cursor-pointer">✕</button>
            </div>
          )}

          {/* Idle / Symmetrical initial converter block */}
          {!activeItem && status === 'idle' && (
            <div className="space-y-8 md:space-y-12 my-auto">
              <div className="text-center space-y-3">
                <h2 className="text-3.5xl md:text-5xl font-light text-brand-text tracking-tight leading-tight px-2">
                  Convert Voice to Document
                </h2>
                <p className="text-sm md:text-lg text-brand-muted max-w-2xl mx-auto px-4 font-light">
                  Upload audio recordings or dictate live to generate structured transcripts featuring <strong className="font-semibold text-brand-primary">Summaries</strong>, <strong className="font-semibold text-brand-primary">Speaker Labels</strong>, and <strong className="font-semibold text-brand-primary">Action Items</strong> using Gemini.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-xs border border-brand-border hover:border-brand-accent transition-all duration-300">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#B4ADA3] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Live Dictation Mode
                  </h3>
                  <Recorder onComplete={handleTranscriptionComplete} status={status} />
                </div>

                <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-xs border border-brand-border hover:border-brand-accent transition-all duration-300">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#B4ADA3] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Audio Payload
                  </h3>
                  <AudioUploader onComplete={handleTranscriptionComplete} status={status} />
                </div>
              </div>
            </div>
          )}

          {/* Active document text/visual feedback */}
          {activeItem && (
            <div className="flex-1 min-h-[480px]">
              <Editor 
                item={activeItem} 
                onSave={(content) => handleUpdateItem(activeItem.id, { content })} 
                onTitleChange={(title) => handleUpdateItem(activeItem.id, { title })}
                isProcessing={status === 'processing'}
              />
            </div>
          )}

          {/* Symmetrical analysis loader */}
          {status === 'processing' && !activeItem && (
            <div className="flex flex-col items-center justify-center py-24 space-y-6 my-auto">
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 md:w-28 md:h-28 border-4 border-brand-subtle-green border-t-brand-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {uploadProgress !== null && uploadProgress < 100 ? (
                    <span className="text-sm font-semibold text-brand-primary">{uploadProgress}%</span>
                  ) : (
                    <svg className="w-8 h-8 text-brand-primary animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-center px-4 space-y-1">
                <h3 className="text-lg md:text-xl font-light text-brand-text">
                  {uploadProgress !== null && uploadProgress < 100 
                    ? `Uploading Audio (${uploadProgress}%)` 
                    : "Analyzing Audio with AI"
                  }
                </h3>
                <p className="text-xs md:text-sm text-brand-muted max-w-sm mx-auto">
                  {uploadProgress !== null && uploadProgress < 100 
                    ? "Streaming audio chunks securely to bypass proxy limits..." 
                    : "Scribing with Gemini: Generating professional summary, timestamps, and action items..."
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;

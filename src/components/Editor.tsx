import React, { useState, useEffect } from 'react';
import { TranscriptionItem } from '../types';

interface EditorProps {
  item: TranscriptionItem;
  onSave: (content: string) => void;
  onTitleChange: (title: string) => void;
  isProcessing: boolean;
}

// Simple helper to parse and render basic inline bold markdown style (**text**)
const renderFormattedText = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-brand-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const Editor: React.FC<EditorProps> = ({ item, onSave, onTitleChange, isProcessing }) => {
  const [content, setContent] = useState(item.content);
  const [title, setTitle] = useState(item.title);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    setContent(item.content);
    setTitle(item.title);
  }, [item.id, item.content, item.title]);

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([`# ${title}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert("Copied raw text to clipboard!");
  };

  // Robust and tolerant parsing of AI transcriptions with various formats
  const parsedSections = React.useMemo(() => {
    const lines = content.split('\n');
    const summaryParagraphs: string[] = [];
    let currentParagraph = '';
    const transcriptLines: Array<{ time: string; speaker: string; text: string }> = [];
    const actionItems: string[] = [];

    let currentSection: 'none' | 'summary' | 'transcript' | 'actions' = 'none';

    for (let line of lines) {
      const trimmed = line.trim();
      
      // Resilient regex detectors for section titles in diverse formats (e.g. ### SUMMARY, 1. SUMMARY, SUMMARY:)
      const isSummaryHeader = 
        /^[#\s]*\d*\.?\s*SUMMARY\b/i.test(trimmed) || 
        /^[#\s]*EXECUTIVE SUMMARY\b/i.test(trimmed);
        
      const isTranscriptHeader = 
        /^[#\s]*\d*\.?\s*TRANSCRIPT\b/i.test(trimmed) ||
        /^[#\s]*TRANSCRIPT FEED\b/i.test(trimmed);
        
      const isActionsHeader = 
        /^[#\s]*\d*\.?\s*ACTION[S]?\s*ITEM[S]?\b/i.test(trimmed) ||
        /^[#\s]*AGREED ACTION[S]?\s*ITEM[S]?\b/i.test(trimmed) ||
        /^[#\s]*KEY ACTION[S]?\b/i.test(trimmed);

      if (isSummaryHeader) {
        if ((currentSection === 'summary' || currentSection === 'none') && currentParagraph.trim()) {
          summaryParagraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        currentSection = 'summary';
        const startIdx = trimmed.indexOf(':');
        if (startIdx !== -1) {
          const rest = trimmed.slice(startIdx + 1).trim();
          if (rest) {
            currentParagraph = rest;
          }
        }
        continue;
      } else if (isTranscriptHeader) {
        if ((currentSection === 'summary' || currentSection === 'none') && currentParagraph.trim()) {
          summaryParagraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        currentSection = 'transcript';
        continue;
      } else if (isActionsHeader) {
        if ((currentSection === 'summary' || currentSection === 'none') && currentParagraph.trim()) {
          summaryParagraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        currentSection = 'actions';
        continue;
      }

      // If we see an empty line, signal a potential paragraph break for summary/none
      if (trimmed === '') {
        if ((currentSection === 'summary' || currentSection === 'none') && currentParagraph.trim()) {
          summaryParagraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        continue;
      }

      if (currentSection === 'summary' || currentSection === 'none') {
        if (currentParagraph) {
          currentParagraph += ' ' + trimmed;
        } else {
          currentParagraph = trimmed;
        }
      } else if (currentSection === 'transcript') {
        // Look for timestamp like [00:15] or 00:15 or similar
        const timeMatch = trimmed.match(/\[?(\d{2}:\d{2})\]?/);
        let time = timeMatch ? timeMatch[1] : '';
        let speaker = 'Speaker';
        let text = trimmed;

        // Clean out matched time from text
        if (timeMatch) {
          text = text.replace(timeMatch[0], '').trim();
        }

        // Look for Speaker label like "Speaker 1:" or "Sarah Jenkins:"
        const speakerMatch = text.match(/^([^:]+):/);
        if (speakerMatch) {
          speaker = speakerMatch[1].trim();
          text = text.slice(speakerMatch[0].length).trim();
        }

        transcriptLines.push({
          time: time || 'Live',
          speaker,
          text
        });
      } else if (currentSection === 'actions') {
        // Strip bullet descriptors, stars, dashes, checkboxes, numbers cleanly
        const cleanAction = trimmed.replace(/^[-*•\d.\[\]\s]+\s*/, '').trim();
        if (cleanAction) {
          actionItems.push(cleanAction);
        }
      }
    }

    if ((currentSection === 'summary' || currentSection === 'none') && currentParagraph.trim()) {
      summaryParagraphs.push(currentParagraph.trim());
    }

    return {
      summary: summaryParagraphs,
      transcript: transcriptLines,
      actions: actionItems
    };
  }, [content]);

  const hasParsedSections = 
    parsedSections.summary.length > 0 || 
    parsedSections.transcript.length > 0 || 
    parsedSections.actions.length > 0;

  return (
    <div 
      className="bg-white rounded-3xl sm:rounded-[40px] shadow-sm border border-brand-border p-4 sm:p-6 md:p-10 flex flex-col h-full min-h-[500px]" 
      id="transcription-editor"
    >
      {/* Editorial Header */}
      <div className="pb-4 sm:pb-6 border-b border-[#F0EFEA] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input 
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              onTitleChange(e.target.value);
            }}
            placeholder="Document title..."
            className="text-xl md:text-2xl font-light text-brand-text border-none focus:ring-0 w-full bg-transparent p-0 focus:outline-none truncate"
            id="editor-title-input"
          />
          <p className="text-xs text-brand-muted mt-1">
            Created on {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* View Mode & Utility Actions */}
        <div className="flex items-center gap-2 sm:gap-3 self-end lg:self-auto w-full lg:w-auto justify-end">
          {/* Toggle View Mode */}
          <div className="bg-[#FAF9F6] p-1 rounded-full border border-brand-border flex">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                viewMode === 'preview' 
                ? 'bg-[#5A6B5D] text-white shadow-xs' 
                : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <span className="hidden sm:inline">Document View</span>
              <span className="inline sm:hidden">Preview</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-2.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                viewMode === 'edit' 
                ? 'bg-[#5A6B5D] text-white shadow-xs' 
                : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <span className="hidden sm:inline">Raw Editor</span>
              <span className="inline sm:hidden">Edit</span>
            </button>
          </div>

          <button 
            onClick={handleCopy}
            className="w-10 h-10 shrink-0 rounded-full border border-brand-border flex items-center justify-center bg-white shadow-xs hover:bg-[#FAF9F6] transition-colors cursor-pointer text-brand-muted hover:text-brand-text"
            title="Copy Raw Text"
            id="editor-copy-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>

          <button 
            onClick={handleDownload}
            className="w-10 h-10 shrink-0 rounded-full border border-brand-border flex items-center justify-center bg-white shadow-xs hover:bg-[#FAF9F6] transition-colors cursor-pointer text-brand-muted hover:text-brand-text"
            title="Export TXT File"
            id="editor-export-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Viewport content */}
      <div className="flex-1 py-4 md:py-6 relative overflow-hidden flex flex-col">
        {viewMode === 'preview' && (
          <div className="flex flex-row items-center lg:flex-wrap gap-1.5 sm:gap-2 pb-3 mb-3 border-b border-[#F0EFEA] text-[10px] sm:text-[11px] select-none overflow-x-auto no-scrollbar">
            <span className="text-[#8e857b] font-medium mr-1 hidden sm:inline shrink-0">Jump to:</span>
            {parsedSections.summary && parsedSections.summary.length > 0 && (
              <button
                onClick={() => scrollToSection('section-summary')}
                className="px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-[#F2F0EA] text-[#5A6B5D] font-semibold border border-brand-border hover:border-brand-text/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>Summary</span>
              </button>
            )}
            {parsedSections.transcript && parsedSections.transcript.length > 0 && (
              <button
                onClick={() => scrollToSection('section-transcript')}
                className="px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-[#F2F0EA] text-[#5A6B5D] font-semibold border border-brand-border hover:border-brand-text/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Transcript</span>
              </button>
            )}
            {parsedSections.actions && parsedSections.actions.length > 0 && (
              <button
                onClick={() => scrollToSection('section-actions')}
                className="px-2 py-1 rounded-lg bg-[#FAF9F6] hover:bg-[#F2F0EA] text-[#5A6B5D] font-semibold border border-brand-border hover:border-brand-text/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                <span>Action Items</span>
              </button>
            )}
          </div>
        )}

        {viewMode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              onSave(e.target.value);
            }}
            placeholder="Transcription content..."
            className="flex-1 w-full resize-none border-none focus:ring-0 text-brand-text leading-relaxed text-base md:text-lg bg-transparent focus:outline-none min-h-[300px]"
            spellCheck={false}
            id="editor-textarea"
          />
        ) : (
          <div className="flex-1 overflow-y-auto space-y-8 pr-2 no-scrollbar scroll-smooth" id="presentation-view">
            {!hasParsedSections ? (
              // Fallback rendering in case structure is raw or all lines parsing returned empty
              <div className="p-6 bg-[#FAF9F6] border border-dashed border-brand-border rounded-3xl">
                <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap font-sans">{content}</p>
              </div>
            ) : (
              <>
                {/* Summary Segment */}
                {parsedSections.summary && parsedSections.summary.length > 0 && (
                  <div id="section-summary" className="scroll-mt-6 p-6 bg-[#FAF9F6] rounded-3xl border border-brand-border space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#B4ADA3]">Executive Summary</p>
                    <div className="space-y-3">
                      {parsedSections.summary.map((para, i) => (
                        <p key={i} className="text-base md:text-lg text-brand-text leading-relaxed font-light font-sans">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcript Area */}
                {parsedSections.transcript.length > 0 && (
                  <div id="section-transcript" className="scroll-mt-6 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#B4ADA3]">Transcript Feed</p>
                    <div className="space-y-4">
                      {parsedSections.transcript.map((line, index) => (
                        <div className="flex gap-4 items-start" key={index}>
                          <span className="text-xs font-bold text-brand-sand pt-1.5 w-12 shrink-0">{line.time}</span>
                          <div className="flex-1 bg-white p-3.5 rounded-2xl border border-[#F0EFEA] hover:shadow-xs transition-shadow">
                            <p className="text-sm font-semibold text-brand-primary mb-1">{line.speaker}</p>
                            <p className="text-[15px] sm:text-base leading-relaxed text-brand-text font-serif italic">{line.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items Segment - Rendered as beautiful Bullet Points */}
                {parsedSections.actions.length > 0 && (
                  <div id="section-actions" className="scroll-mt-6 space-y-4 pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#B4ADA3]">Agreed Action Items</p>
                    <ul className="space-y-3.5 pl-2">
                      {parsedSections.actions.map((action, idx) => (
                        <li 
                          key={idx} 
                          className="flex items-start gap-3.5"
                        >
                          <span className="mt-2.5 h-1.5 w-1.5 bg-[#5A6B5D] rounded-full shrink-0"></span>
                          <span className="text-base md:text-lg text-brand-text leading-relaxed font-light">
                            {renderFormattedText(action)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {isProcessing && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center rounded-b-2xl z-20">
            <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-brand-border flex items-center gap-4 animate-in fade-in zoom-in duration-300">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
              <span className="font-semibold text-brand-text text-xs tracking-tight">Syncing Document...</span>
            </div>
          </div>
        )}
      </div>

      {/* Responsive Metadata Tray */}
      <div className="mt-4 pt-4 border-t border-[#F0EFEA] flex justify-between items-center text-xs text-brand-muted font-medium select-none">
        <div className="flex gap-4 sm:gap-8">
          <div className="text-left">
            <p className="text-[9px] uppercase tracking-widest text-brand-muted-light font-bold">Total Words</p>
            <p className="text-lg font-semibold text-[#3E362E]">{content.split(/\s+/).filter(x => x.length > 0).length}</p>
          </div>
          <div className="text-left">
            <p className="text-[9px] uppercase tracking-widest text-brand-muted-light font-bold">Confidence</p>
            <p className="text-lg font-semibold text-brand-primary">99.1%</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-widest text-[#B4ADA3] font-bold">Sync Status</p>
          <div className="flex items-center gap-1.5 mt-0.5 justify-end">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span className="text-xs font-semibold text-brand-primary lowercase tracking-tight">Auto-saved</span>
          </div>
        </div>
      </div>
    </div>
  );
};

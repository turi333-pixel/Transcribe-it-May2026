import React, { useMemo } from 'react';
import { TranscriptionItem } from '../types';

interface SidebarProps {
  items: TranscriptionItem[];
  activeId?: string;
  onSelect: (item: TranscriptionItem) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activeId, onSelect, onDelete, onNew, onClose }) => {
  // Calculate actual localStorage utilization for a functional, high-fidelity experience
  const storageUsage = useMemo(() => {
    try {
      const serialized = JSON.stringify(localStorage);
      const bytes = new Blob([serialized]).size;
      const mb = bytes / (1024 * 1024);
      const limit = 5.0; // standard localStorage limit is ~5MB
      const percentage = Math.min((mb / limit) * 100, 100);
      return {
        used: mb.toFixed(3),
        total: limit.toFixed(1),
        percentage: Math.max(percentage, 5) // At least show a tiny sliver if empty
      };
    } catch {
      return { used: '0.001', total: '5.0', percentage: 5 };
    }
  }, [items]);

  return (
    <aside 
      className="w-72 h-full border-r border-brand-border bg-white flex flex-col shrink-0 shadow-2xl lg:shadow-none" 
      id="sidebar-container"
    >
      {/* Brand logo block */}
      <div className="p-6 pb-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#4A433A]">TranscribeIT</h1>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="text-brand-muted p-1 hover:bg-brand-bg rounded-lg cursor-pointer lg:hidden"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Primary Actions */}
      <div className="p-4 pt-2">
        <button 
          onClick={onNew}
          className="w-full flex items-center gap-3 px-4 py-3 bg-brand-subtle-green text-brand-primary rounded-2xl font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-sm border border-[#DCE4DB] cursor-pointer"
          id="new-document-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
          New Session
        </button>
      </div>

      {/* Past Documents List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 no-scrollbar">
        <h3 className="px-2 text-[10px] font-bold text-brand-muted-light uppercase tracking-widest mb-3">
          Past Documents
        </h3>
        {items.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="text-brand-border mb-2">
              <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs text-brand-muted">No documents found.</p>
          </div>
        ) : (
          items.map(item => {
            const isActive = activeId === item.id;
            return (
              <div 
                key={item.id}
                onClick={() => onSelect(item)}
                className={`group px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                  isActive 
                  ? 'bg-brand-bg border-brand-border text-brand-text shadow-sm' 
                  : 'hover:bg-brand-bg/50 border-transparent text-brand-muted hover:text-brand-text'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-semibold text-xs truncate pr-2 ${isActive ? 'text-brand-text' : 'text-brand-muted group-hover:text-brand-text'}`}>
                    {item.title}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this transcription?")) onDelete(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-brand-muted-light hover:text-red-500 transition-opacity p-0.5 cursor-pointer"
                    id={`delete-btn-${item.id}`}
                    aria-label="Delete transcription"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex justify-between items-center text-[10px] text-brand-muted-light">
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  <span className="truncate max-w-[120px]">
                    {item.content ? item.content.slice(0, 25).replace(/[#\n_*`-]/g, '') : "Draft"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Storage Gauge */}
      <div className="p-4 m-4 bg-[#FAF9F6] rounded-3xl border border-brand-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#B4ADA3] mb-2">Storage Usage</p>
        <div className="w-full h-1.5 bg-brand-border rounded-full mb-2 overflow-hidden">
          <div 
            className="h-full bg-brand-sand rounded-full transition-all duration-300" 
            style={{ width: `${storageUsage.percentage}%` }}
          />
        </div>
        <p className="text-[10px] text-brand-muted">{storageUsage.used}MB of {storageUsage.total}MB used</p>
      </div>

      <div className="py-3 bg-[#FAF9F6] border-t border-brand-border text-[9px] text-[#A59D84] font-medium text-center uppercase tracking-wider">
        TranscribeIT AI • v1.1
      </div>
    </aside>
  );
};

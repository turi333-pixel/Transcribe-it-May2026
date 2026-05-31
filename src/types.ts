export interface TranscriptionItem {
  id: string;
  title: string;
  content: string;
  date: number;
  duration?: number;
  status: 'draft' | 'saved';
}

export type ProcessingStatus = 'idle' | 'recording' | 'processing' | 'error';

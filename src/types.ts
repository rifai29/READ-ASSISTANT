export interface Manga {
  id: string;
  title: string;
  author?: string;
  description?: string;
  coverUrl: string;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  genres: string[];
  source: string;
}

export interface Chapter {
  id: string;
  mangaId: string;
  number: number;
  title?: string;
  pages: string[]; // URLs or IDs
  scanlator?: string;
  releasedAt: string;
}

export interface LibraryItem {
  id: string;
  mangaId: string;
  addedAt: number;
  lastReadAt?: number;
  lastChapterRead?: string;
  lastPageRead?: number;
  status: 'reading' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_read';
}

export interface ReadingHistory {
  id: string;
  mangaId: string;
  chapterId: string;
  pageNumber: number;
  timestamp: number;
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'amoled';
  readingDirection: 'ltr' | 'rtl' | 'vertical';
  fitToWidth: boolean;
}

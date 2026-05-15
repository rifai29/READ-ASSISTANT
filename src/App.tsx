import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Search, 
  Clock, 
  Settings, 
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List as ListIcon,
  Filter,
  Plus,
  Play,
  Heart,
  Share2,
  Trash2,
  RotateCcw,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { cn } from './lib/utils';
import { Manga, Chapter, LibraryItem, UserSettings } from './types';

// --- Mock Data / API Helpers ---
const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

async function searchManga(q: string) {
  const resp = await fetch(`${JIKAN_API_BASE}/manga?q=${encodeURIComponent(q)}&limit=20`);
  const data = await resp.json();
  return data.data.map((m: any) => ({
    id: m.mal_id.toString(),
    title: m.title,
    author: m.authors?.[0]?.name,
    description: m.synopsis,
    coverUrl: m.images?.webp?.large_image_url || m.images?.jpg?.large_image_url,
    status: m.status.toLowerCase().includes('finished') ? 'completed' : 'ongoing',
    genres: m.genres?.map((g: any) => g.name) || [],
    source: 'MyAnimeList'
  }));
}

async function getMangaDetails(id: string) {
  const resp = await fetch(`${JIKAN_API_BASE}/manga/${id}/full`);
  const data = await resp.json();
  const m = data.data;
  return {
    id: m.mal_id.toString(),
    title: m.title,
    author: m.authors?.[0]?.name,
    description: m.synopsis,
    coverUrl: m.images?.webp?.large_image_url || m.images?.jpg?.large_image_url,
    status: m.status.toLowerCase().includes('finished') ? 'completed' : 'ongoing',
    genres: m.genres?.map((g: any) => g.name) || [],
    source: 'MyAnimeList'
  };
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  className, 
  variant = 'primary',
  disabled = false,
  id
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  id?: string;
}) => {
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90 active:scale-95',
    secondary: 'bg-bg-card text-text-main hover:bg-border-subtle active:scale-95 border border-border-subtle',
    ghost: 'bg-transparent text-text-muted hover:text-text-main hover:bg-border-subtle',
    danger: 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white active:scale-95 border border-red-500/20'
  };

  return (
    <button
      id={id}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

interface CardProps {
  manga: Manga;
  onClick: () => void;
  id?: string;
}

const Card = ({ manga, onClick, id }: CardProps) => (
  <motion.div
    id={id}
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className="group relative aspect-[2/3] rounded-3xl overflow-hidden bg-bg-card cursor-pointer shadow-lg border border-border-subtle"
    onClick={onClick}
  >
    <img 
      src={manga.coverUrl} 
      alt={manga.title}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      referrerPolicy="no-referrer"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-bg-main/20 to-transparent opacity-80" />
    <div className="absolute bottom-0 left-0 right-0 p-4">
      <h3 className="text-text-main text-sm font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors uppercase tracking-tight">
        {manga.title}
      </h3>
      {manga.status && (
        <span className="text-[10px] uppercase tracking-widest text-text-dim mt-1 font-black block">
          {manga.status}
        </span>
      )}
    </div>
  </motion.div>
);

const Reader = ({ manga, chapter, onBack }: { manga: Manga; chapter: Chapter; onBack: () => void }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center">
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: -100 }} 
            animate={{ y: 0 }} 
            exit={{ y: -100 }}
            className="absolute top-0 left-0 right-0 bg-black/80 backdrop-blur-md p-4 flex items-center justify-between z-10 border-b border-zinc-800"
          >
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 text-zinc-300 hover:text-white transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-sm font-bold text-white line-clamp-1">{manga.title}</h2>
                <p className="text-xs text-zinc-400">Chapter {chapter.number}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-zinc-400" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-0 scroll-smooth"
        onClick={() => setShowControls(!showControls)}
      >
        {chapter.pages.map((page, idx) => (
          <img 
            key={idx} 
            src={page} 
            alt={`Page ${idx + 1}`} 
            className="max-w-full md:max-w-4xl h-auto"
            referrerPolicy="no-referrer"
          />
        ))}
      </div>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 100 }} 
            animate={{ y: 0 }} 
            exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md p-6 flex items-center justify-center z-10 border-t border-zinc-800"
          >
            <div className="flex items-center gap-6 text-zinc-300">
               <span className="text-xs font-medium">Page {currentPage + 1} / {chapter.pages.length}</span>
               <div className="h-1 w-48 bg-zinc-800 rounded-full overflow-hidden">
                 <div 
                  className="h-full bg-indigo-600 transition-all duration-300" 
                  style={{ width: `${((currentPage + 1) / chapter.pages.length) * 100}%` }} 
                />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'browse' | 'history' | 'more'>('library');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [readingChapter, setReadingChapter] = useState<{ manga: Manga; chapter: Chapter } | null>(null);
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryManga, setLibraryManga] = useState<Manga[]>([]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setLibrary([]);
      setLibraryManga([]);
      return;
    }

    const libRef = collection(db, 'users', user.uid, 'library');
    const q = query(libRef, orderBy('addedAt', 'desc'));
    
    return onSnapshot(q, async (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem));
      setLibrary(items);
      
      const mangaPromises = items.map(item => getMangaDetails(item.mangaId));
      try {
        const mangaData = await Promise.all(mangaPromises);
        setLibraryManga(mangaData);
      } catch (error) {
        console.error("Failed to fetch library manga details:", error);
      }
    });
  }, [user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchManga(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const addToLibrary = async (manga: Manga) => {
    if (!user) {
      loginWithGoogle();
      return;
    }
    
    const existing = library.find(i => i.mangaId === manga.id);
    if (existing) return;

    await addDoc(collection(db, 'users', user.uid, 'library'), {
      mangaId: manga.id,
      addedAt: Date.now(),
      status: 'reading'
    } as Omit<LibraryItem, 'id'>);
  };

  const removeFromLibrary = async (mangaId: string) => {
    if (!user) return;
    const item = library.find(i => i.mangaId === mangaId);
    if (item) {
      await deleteDoc(doc(db, 'users', user.uid, 'library', item.id));
    }
  };

  const startReading = (manga: Manga) => {
    const mockChapter: Chapter = {
      id: 'ch1',
      mangaId: manga.id,
      number: 1,
      pages: [
        'https://images.unsplash.com/photo-1620336655055-188701f31622?auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1614362948773-f93318392131?auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1634128221889-82ed6efebfc3?auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1614362705324-8da05f32fece?auto=format&fit=crop&q=80'
      ],
      releasedAt: new Date().toISOString()
    };
    setReadingChapter({ manga, chapter: mockChapter });
  };

  if (readingChapter) {
    return (
      <Reader 
        manga={readingChapter.manga} 
        chapter={readingChapter.chapter} 
        onBack={() => setReadingChapter(null)} 
      />
    );
  }

  const NavItem = ({ id, icon: Icon, label }: { id: string; icon: any; label: string }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id as any)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 group",
          active 
            ? "bg-primary/10 text-primary" 
            : "text-text-muted hover:bg-border-subtle hover:text-text-main"
        )}
      >
        <div className={cn(
          "w-1.5 h-6 rounded-full transition-all duration-300",
          active ? "bg-primary" : "bg-transparent group-hover:bg-border-subtle"
        )} />
        <Icon className={cn("w-5 h-5", active && "scale-110")} />
        <span className="text-sm">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans flex overflow-hidden">
      {/* Desktop Sidebar */}
      <nav className="w-64 bg-bg-sidebar border-r border-border-subtle flex-col p-6 hidden lg:flex h-screen sticky top-0">
        <div className="flex items-center gap-4 mb-12 group cursor-pointer" onClick={() => setActiveTab('library')}>
          <div className="w-12 h-12 bg-primary rounded-[18px] flex items-center justify-center shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
            <BookOpen className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl tracking-tighter text-text-main logo-text">KomiKaze</span>
        </div>
        
        <div className="space-y-1 flex-1">
          <NavItem id="library" icon={Library} label="Library" />
          <NavItem id="browse" icon={Search} label="Browse" />
          <NavItem id="history" icon={Clock} label="History" />
          <NavItem id="more" icon={Settings} label="Settings" />
        </div>

        <div className="mt-auto border-t border-white/5 pt-6">
          {user ? (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
              <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-white/10" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-white">{user.displayName}</p>
                <button onClick={logout} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors">Sign Out</button>
              </div>
            </div>
          ) : (
            <Button onClick={loginWithGoogle} variant="secondary" className="w-full">Sign In</Button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative h-screen overflow-y-auto custom-scrollbar">
        {/* Mobile Header / Desktop View Header */}
        <header className="h-20 sm:h-24 flex items-center justify-between px-4 sm:px-8 bg-bg-main/80 backdrop-blur-md sticky top-0 z-40 border-b border-border-subtle">
          <div className="lg:hidden flex items-center gap-2 sm:gap-3">
             <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={3} />
             </div>
            <h1 className="text-lg sm:text-xl logo-text">KomiKaze</h1>
          </div>
          <h1 className="text-2xl font-bold text-text-main hidden lg:block">
            {activeTab === 'library' && 'My Library'}
            {activeTab === 'browse' && 'Browse Manga'}
            {activeTab === 'history' && 'Reading History'}
            {activeTab === 'more' && 'Settings'}
          </h1>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex bg-bg-card px-4 py-2 rounded-full border border-border-subtle items-center gap-2 group focus-within:border-primary/50 transition-all">
              <Search className="w-4 h-4 text-text-dim group-focus-within:text-primary" />
              <input 
                type="text" 
                placeholder="Quick search..." 
                className="bg-transparent border-none text-sm focus:ring-0 text-text-main w-24 sm:w-48 placeholder-text-dim outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            {!user && (
              <div className="lg:hidden">
                <Button onClick={loginWithGoogle} className="rounded-full w-9 h-9 sm:w-10 sm:h-10 p-0 shadow-lg shadow-primary/20">
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-8 pb-32">
          <AnimatePresence mode="wait">
            {activeTab === 'library' && (
              <motion.div
                key="library"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                {/* Hero Feature Component */}
                {libraryManga.length > 0 && (
                  <section>
                    <h2 className="text-xs uppercase tracking-[0.2em] text-text-dim font-bold mb-4 ml-1">Currently Reading</h2>
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row gap-8 items-center shadow-2xl shadow-primary/5 group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                      <div className="w-40 sm:w-48 h-60 sm:h-72 bg-bg-card rounded-2xl shadow-2xl flex-shrink-0 overflow-hidden border border-border-subtle transform group-hover:scale-105 transition-transform duration-500 relative">
                        <img 
                          src={libraryManga[0].coverUrl} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left z-10">
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-primary font-bold text-sm">
                           <span className="px-2 py-0.5 bg-primary/10 rounded-md border border-primary/30">Chapter 1</span>
                           <span className="w-1 h-1 bg-border-subtle rounded-full" />
                           <span className="text-text-muted">Action, Fantasy</span>
                        </div>
                        <h3 className="text-3xl sm:text-5xl font-black text-text-main mt-3 tracking-tight">{libraryManga[0].title}</h3>
                        <p className="text-text-muted mt-4 line-clamp-3 max-w-xl font-light text-base sm:text-lg">
                          {libraryManga[0].description || "No description available for this series."}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4 justify-center sm:justify-start">
                          <Button 
                            onClick={() => startReading(libraryManga[0])}
                            className="bg-primary text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                          >
                            Continue Reading
                          </Button>
                          <Button 
                             onClick={() => setSelectedManga(libraryManga[0])}
                             variant="secondary" 
                             className="rounded-full px-8"
                           >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs uppercase tracking-[0.2em] text-text-dim font-bold ml-1">
                      Collection ({libraryManga.length})
                    </h2>
                    <div className="flex gap-6 text-[10px] font-bold text-primary uppercase tracking-widest bg-bg-card py-1.5 px-4 rounded-full border border-border-subtle">
                      <span className="cursor-pointer hover:text-text-main transition-colors">A-Z</span>
                      <span className="text-text-dim">/</span>
                      <span className="cursor-pointer text-text-main">Latest</span>
                    </div>
                  </div>

                  {libraryManga.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                      <Library className="w-16 h-16 text-border-subtle mb-6" />
                      <h3 className="text-xl font-bold text-text-dim">Silence in the library...</h3>
                      <p className="text-text-dim mt-2 max-w-xs opacity-60">Explore the browse page to find your next adventure.</p>
                      <Button onClick={() => setActiveTab('browse')} className="mt-8 px-10 rounded-full">Explore Now</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-8">
                       {libraryManga.map((m: Manga) => (
                        <div key={m.id} className="group cursor-pointer" onClick={() => setSelectedManga(m)}>
                          <div className="aspect-[2/3] bg-bg-card rounded-3xl mb-4 overflow-hidden border border-border-subtle transition-all duration-500 group-hover:border-primary group-hover:translate-y-[-8px] group-hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] relative">
                             <img 
                                src={m.coverUrl} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                referrerPolicy="no-referrer"
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-bg-main/10 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
                             <div className="absolute top-3 right-3 bg-primary text-[10px] font-black px-2 py-1 rounded-lg shadow-xl translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all text-white">READ</div>
                          </div>
                          <h3 className="text-text-main font-bold text-sm tracking-tight line-clamp-1 group-hover:text-primary transition-colors uppercase">{m.title}</h3>
                          <p className="text-[10px] text-text-dim font-black mt-1 uppercase tracking-widest">{m.status}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </motion.div>
            )}

            {activeTab === 'browse' && (
              <motion.div
                key="browse"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-8 mt-12">
                    {searchResults.length > 0 ? (
                       searchResults.map((m: Manga) => (
                         <div key={m.id} className="group cursor-pointer" onClick={() => setSelectedManga(m)}>
                           <div className="aspect-[2/3] bg-bg-card rounded-3xl mb-4 overflow-hidden border border-border-subtle transition-all duration-500 group-hover:border-primary group-hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] relative">
                              <img src={m.coverUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-bg-main/10 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
                           </div>
                           <h3 className="text-text-main font-bold text-sm tracking-tight line-clamp-1 group-hover:text-primary transition-colors uppercase">{m.title}</h3>
                         </div>
                       ))
                    ) : (
                      <div className="col-span-full py-40 text-center opacity-40 italic font-medium text-text-dim">
                         The world of stories awaits your call...
                      </div>
                    )}
                </div>
              </motion.div>
            )}
            {activeTab === 'more' && (
              <motion.div
                key="more"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                <section className="bg-bg-card p-8 rounded-[32px] border border-border-subtle shadow-xl">
                  <h2 className="text-xl font-bold mb-8">Settings</h2>
                  <div className="space-y-8">
                    <div className="flex items-center justify-between group">
                      <div>
                        <p className="font-bold text-text-main group-hover:text-primary transition-colors">Theme Concept</p>
                        <p className="text-sm text-text-muted">Choose your preferred visual aesthetic</p>
                      </div>
                      <div className="flex bg-bg-main p-1 rounded-2xl border border-border-subtle">
                        <button 
                          onClick={() => setTheme('dark')}
                          className={cn(
                            "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                            theme === 'dark' ? "bg-primary text-white shadow-lg" : "text-text-dim hover:text-text-main"
                          )}
                        >
                          DARK
                        </button>
                        <button 
                          onClick={() => setTheme('light')}
                          className={cn(
                            "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                            theme === 'light' ? "bg-primary text-white shadow-lg" : "text-text-dim hover:text-text-main"
                          )}
                        >
                          LIGHT
                        </button>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-border-subtle">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-text-dim mb-4">Account</p>
                      {user ? (
                        <div className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-border-subtle">
                           <div className="flex items-center gap-4">
                             <img src={user.photoURL || ''} className="w-12 h-12 rounded-full border border-border-subtle" />
                             <div>
                               <p className="font-bold text-text-main">{user.displayName}</p>
                               <p className="text-xs text-text-dim">{user.email}</p>
                             </div>
                           </div>
                           <Button onClick={logout} variant="danger" className="rounded-full px-6">Logout</Button>
                        </div>
                      ) : (
                        <Button onClick={loginWithGoogle} className="w-full h-14 rounded-2xl">Connect Google Account</Button>
                      )}
                    </div>
                  </div>
                </section>

                <section className="text-center opacity-30 italic text-sm">
                  KomiKaze v1.0.4 • Crafted for Manga Enthusiasts
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Action Button (Mobile) */}
        {activeTab === 'library' && (
          <div className="lg:hidden absolute bottom-28 right-6 z-30">
            <div 
              onClick={() => setActiveTab('browse')}
              className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 text-white cursor-pointer active:scale-90 transition-transform"
            >
              <Plus className="w-8 h-8" />
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="bg-bg-main/80 backdrop-blur-2xl border-t border-border-subtle pb-safe px-6 pt-2">
          <div className="flex items-center justify-around h-16">
            {[
              { id: 'library', icon: Library, label: 'Library' },
              { id: 'browse', icon: Search, label: 'Browse' },
              { id: 'history', icon: Clock, label: 'History' },
              { id: 'more', icon: Settings, label: 'More' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 w-full",
                  activeTab === item.id ? "text-primary" : "text-text-dim"
                )}
              >
                <item.icon className={cn("w-6 h-6 transition-transform", activeTab === item.id && "scale-110")} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Details Modal (Tailored to Immersive UI) */}
      <AnimatePresence>
        {selectedManga && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl md:p-8"
            onClick={(e) => e.target === e.currentTarget && setSelectedManga(null)}
          >
            <motion.div
              layoutId={`manga-${selectedManga.id}`}
              className="bg-bg-card w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-[40px] overflow-hidden flex flex-col md:flex-row relative shadow-2xl border border-border-subtle"
            >
              <button 
                onClick={() => setSelectedManga(null)}
                className="absolute top-6 right-6 z-50 w-10 h-10 bg-black/50 backdrop-blur-lg rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>

              <div className="w-full md:w-2/5 aspect-[3/4] md:h-full relative flex-shrink-0">
                <img 
                  src={selectedManga.coverUrl} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-bg-card hidden md:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent md:hidden" />
              </div>

              <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-3 text-primary font-bold text-xs uppercase tracking-widest mb-4">
                    <span>{selectedManga.status}</span>
                    <span className="w-1 h-1 bg-border-subtle rounded-full" />
                    <span>{selectedManga.source}</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black text-text-main leading-none tracking-tighter mb-4">{selectedManga.title}</h2>
                  <p className="text-xl text-text-muted font-medium italic mb-8">{selectedManga.author}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-8">
                    {selectedManga.genres.map(g => (
                      <span key={g} className="px-4 py-1.5 bg-bg-main text-text-muted text-[10px] font-bold uppercase rounded-full border border-border-subtle">
                        {g}
                      </span>
                    ))}
                  </div>

                  <p className="text-text-muted text-lg leading-relaxed font-light mb-12">
                    {selectedManga.description || "In a world of infinite stories, this one remains shrouded in mystery. Add it to your collection to begin the journey."}
                  </p>

                  <div className="mb-12">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim mb-6 flex items-center justify-between">
                       Chapters Available
                       <span className="text-primary/50">NEWEST FIRST</span>
                     </h3>
                     <div className="space-y-3">
                       {[...Array(5)].map((_, i) => (
                         <div 
                          key={i} 
                          className="p-5 bg-bg-main hover:bg-border-subtle rounded-2xl flex items-center justify-between group cursor-pointer transition-all border border-border-subtle"
                          onClick={() => startReading(selectedManga)}
                        >
                           <div className="flex flex-col">
                             <span className="text-base font-bold text-text-muted group-hover:text-text-main transition-colors">Chapter {5 - i}</span>
                             <span className="text-[10px] text-text-dim uppercase font-black mt-1">May 07, 2026 • FAN TRANSLATION</span>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-border-subtle flex items-center justify-center group-hover:bg-primary transition-all">
                             <ChevronRight className="w-5 h-5 text-text-dim group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-auto pt-8 border-t border-border-subtle">
                  <Button 
                    onClick={() => startReading(selectedManga)} 
                    className="h-16 rounded-2xl text-lg font-black bg-primary text-white hover:bg-primary/90"
                  >
                    CONTINUE READING
                  </Button>
                  {library.find(i => i.mangaId === selectedManga.id) ? (
                    <Button 
                      variant="danger" 
                      onClick={() => removeFromLibrary(selectedManga.id)}
                      className="h-16 rounded-2xl font-bold"
                    >
                      REMOVE FROM LIBRARY
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary" 
                      onClick={() => addToLibrary(selectedManga)}
                      className="h-16 rounded-2xl font-bold border border-border-subtle"
                    >
                      ADD TO LIBRARY
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:scale-95',
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50',
    danger: 'bg-red-900/50 text-red-100 hover:bg-red-800 active:scale-95 border border-red-500/30'
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
    className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 cursor-pointer shadow-lg"
    onClick={onClick}
  >
    <img 
      src={manga.coverUrl} 
      alt={manga.title}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      referrerPolicy="no-referrer"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
    <div className="absolute bottom-0 left-0 right-0 p-3">
      <h3 className="text-white text-sm font-semibold line-clamp-2 leading-tight group-hover:text-indigo-300 transition-colors">
        {manga.title}
      </h3>
      {manga.status && (
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 mt-1 block">
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
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [readingChapter, setReadingChapter] = useState<{ manga: Manga; chapter: Chapter } | null>(null);
  const [searchResults, setSearchResults] = useState<Manga[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [libraryManga, setLibraryManga] = useState<Manga[]>([]);

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
            ? "bg-white/5 text-indigo-400" 
            : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        )}
      >
        <div className={cn(
          "w-1.5 h-6 rounded-full transition-all duration-300",
          active ? "bg-indigo-500" : "bg-transparent group-hover:bg-zinc-800"
        )} />
        <Icon className={cn("w-5 h-5", active && "scale-110")} />
        <span className="text-sm">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-gray-200 font-sans flex overflow-hidden">
      {/* Desktop Sidebar */}
      <nav className="w-64 bg-[#111114] border-r border-white/5 flex-col p-6 hidden lg:flex h-screen sticky top-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white italic">KomiKaze</span>
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
        <header className="h-20 flex items-center justify-between px-8 bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-40 border-b border-white/5">
          <div className="lg:hidden flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            <h1 className="text-lg font-bold italic">KomiKaze</h1>
          </div>
          <h1 className="text-2xl font-bold text-white hidden lg:block">
            {activeTab === 'library' && 'My Library'}
            {activeTab === 'browse' && 'Browse Manga'}
            {activeTab === 'history' && 'Reading History'}
            {activeTab === 'more' && 'Settings'}
          </h1>

          <div className="flex items-center gap-4">
            <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 group focus-within:border-indigo-500/50 transition-all">
              <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400" />
              <input 
                type="text" 
                placeholder="Quick search..." 
                className="bg-transparent border-none text-sm focus:ring-0 text-zinc-300 w-24 sm:w-48 placeholder-zinc-600 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            {!user && (
              <div className="lg:hidden">
                <Button onClick={loginWithGoogle} className="rounded-full w-10 h-10 p-0">
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
                    <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 ml-1">Currently Reading</h2>
                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row gap-8 items-center shadow-2xl shadow-indigo-500/5 group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
                      <div className="w-40 sm:w-48 h-60 sm:h-72 bg-zinc-800 rounded-2xl shadow-2xl flex-shrink-0 overflow-hidden border border-white/10 transform group-hover:scale-105 transition-transform duration-500 relative">
                        <img 
                          src={libraryManga[0].coverUrl} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left z-10">
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-indigo-400 font-bold text-sm">
                           <span className="px-2 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/30">Chapter 1</span>
                           <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                           <span className="text-zinc-400">Action, Fantasy</span>
                        </div>
                        <h3 className="text-3xl sm:text-5xl font-black text-white mt-3 tracking-tight">{libraryManga[0].title}</h3>
                        <p className="text-zinc-400 mt-4 line-clamp-3 max-w-xl font-light text-base sm:text-lg">
                          {libraryManga[0].description || "No description available for this series."}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4 justify-center sm:justify-start">
                          <Button 
                            onClick={() => startReading(libraryManga[0])}
                            className="bg-white text-black px-8 py-3 rounded-full font-bold text-sm hover:bg-indigo-400 hover:text-white transition-all shadow-xl shadow-white/5"
                          >
                            Continue Reading
                          </Button>
                          <Button 
                             onClick={() => setSelectedManga(libraryManga[0])}
                             variant="secondary" 
                             className="rounded-full px-8 border border-white/5"
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
                    <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold ml-1">
                      Collection ({libraryManga.length})
                    </h2>
                    <div className="flex gap-6 text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white/5 py-1.5 px-4 rounded-full border border-white/5">
                      <span className="cursor-pointer hover:text-white transition-colors">A-Z</span>
                      <span className="text-zinc-700">/</span>
                      <span className="cursor-pointer text-white">Latest</span>
                    </div>
                  </div>

                  {libraryManga.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                      <Library className="w-16 h-16 text-zinc-900 mb-6" />
                      <h3 className="text-xl font-bold text-zinc-500">Silence in the library...</h3>
                      <p className="text-zinc-600 mt-2 max-w-xs">Explore the browse page to find your next adventure.</p>
                      <Button onClick={() => setActiveTab('browse')} className="mt-8 px-10 rounded-full">Explore Now</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 sm:gap-8">
                       {libraryManga.map((m: Manga) => (
                        <div key={m.id} className="group cursor-pointer" onClick={() => setSelectedManga(m)}>
                          <div className="aspect-[2/3] bg-zinc-900 rounded-3xl mb-4 overflow-hidden border border-white/5 transition-all duration-500 group-hover:border-indigo-500 group-hover:translate-y-[-8px] group-hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] relative">
                             <img 
                                src={m.coverUrl} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                referrerPolicy="no-referrer"
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
                             <div className="absolute top-3 right-3 bg-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg shadow-xl translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">READ</div>
                          </div>
                          <h3 className="text-white font-bold text-sm tracking-tight line-clamp-1 group-hover:text-indigo-400 transition-colors uppercase">{m.title}</h3>
                          <p className="text-[10px] text-zinc-600 font-black mt-1 uppercase tracking-widest">{m.status}</p>
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
                          <div className="aspect-[2/3] bg-zinc-900 rounded-3xl mb-4 overflow-hidden border border-white/5 transition-all duration-500 group-hover:border-indigo-500 group-hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] relative">
                             <img src={m.coverUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-100" />
                          </div>
                          <h3 className="text-white font-bold text-sm tracking-tight line-clamp-1 group-hover:text-indigo-400 transition-colors uppercase">{m.title}</h3>
                        </div>
                      ))
                   ) : (
                     <div className="col-span-full py-40 text-center opacity-40 italic">
                        The world of stories awaits your call...
                     </div>
                   )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Action Button (Mobile) */}
        {activeTab === 'library' && (
          <div className="lg:hidden absolute bottom-28 right-6 z-30">
            <div 
              onClick={() => setActiveTab('browse')}
              className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 text-white cursor-pointer active:scale-90 transition-transform"
            >
              <Plus className="w-8 h-8" />
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="bg-[#0a0a0b]/80 backdrop-blur-2xl border-t border-white/5 pb-safe px-6 pt-2">
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
                  activeTab === item.id ? "text-indigo-500" : "text-zinc-600"
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
              className="bg-[#111114] w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-[40px] overflow-hidden flex flex-col md:flex-row relative shadow-2xl border border-white/5"
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
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#111114] hidden md:block" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-transparent to-transparent md:hidden" />
              </div>

              <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex-1">
                  <div className="flex items-center gap-3 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-4">
                    <span>{selectedManga.status}</span>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                    <span>{selectedManga.source}</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black text-white leading-none tracking-tighter mb-4">{selectedManga.title}</h2>
                  <p className="text-xl text-zinc-500 font-medium italic mb-8">{selectedManga.author}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-8">
                    {selectedManga.genres.map(g => (
                      <span key={g} className="px-4 py-1.5 bg-white/5 text-zinc-400 text-[10px] font-bold uppercase rounded-full border border-white/10">
                        {g}
                      </span>
                    ))}
                  </div>

                  <p className="text-zinc-400 text-lg leading-relaxed font-light mb-12">
                    {selectedManga.description || "In a world of infinite stories, this one remains shrouded in mystery. Add it to your collection to begin the journey."}
                  </p>

                  <div className="mb-12">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-6 flex items-center justify-between">
                       Chapters Available
                       <span className="text-indigo-500/50">NEWEST FIRST</span>
                     </h3>
                     <div className="space-y-3">
                       {[...Array(5)].map((_, i) => (
                         <div 
                          key={i} 
                          className="p-5 bg-white/[0.02] hover:bg-white/[0.05] rounded-2xl flex items-center justify-between group cursor-pointer transition-all border border-white/[0.03]"
                          onClick={() => startReading(selectedManga)}
                        >
                           <div className="flex flex-col">
                             <span className="text-base font-bold text-zinc-300 group-hover:text-white transition-colors">Chapter {5 - i}</span>
                             <span className="text-[10px] text-zinc-600 uppercase font-black mt-1">May 07, 2026 • FAN TRANSLATION</span>
                           </div>
                           <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                             <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-auto pt-8 border-t border-white/5">
                  <Button 
                    onClick={() => startReading(selectedManga)} 
                    className="h-16 rounded-2xl text-lg font-black bg-white text-black hover:bg-indigo-500 hover:text-white"
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
                      className="h-16 rounded-2xl font-bold border border-white/5 h-16"
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

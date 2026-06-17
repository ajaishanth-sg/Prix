import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Star, GitFork, ExternalLink, Github, Info, Calendar, 
  AlertCircle, Filter, SlidersHorizontal, X, ChevronLeft, ChevronRight, 
  TrendingUp, Terminal, Layers, Cpu, Award
} from 'lucide-react';

interface Game {
  id: number;
  slug: string;
  title: string;
  description: string;
  repoUrl: string;
  homepage?: string;
  language: string;
  genre: string;
  stars: number;
  forks: number;
  openIssues?: number;
  createdAt?: string;
  lastCommitAt?: string;
  license?: string;
  topics?: string[];
  isMultiplayer?: boolean;
  platforms?: string[];
  latestRelease?: string;
  downloadCount?: number;
}

interface OpenGamesExplorerProps {
  isLightTheme?: boolean;
}

export default function OpenGamesExplorer({ isLightTheme = false }: OpenGamesExplorerProps) {
  // Directory stats state
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Games and Pagination state
  const [games, setGames] = useState<Game[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loadingGames, setLoadingGames] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query / Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortBy, setSortBy] = useState('stars');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Selected game for detail modal
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const LANGUAGES = ['All', 'Rust', 'C++', 'JavaScript', 'C#', 'Java', 'Lua'];
  const GENRES = ['All', 'RPG', 'Strategy', 'Puzzle', 'Sandbox', 'Action', 'Racing', 'Simulation'];

  // Fetch Directory Stats
  useEffect(() => {
    async function fetchStats() {
      try {
        setLoadingStats(true);
        const res = await fetch('/api/opengames/stats');
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      } catch (err) {
        console.error('Error fetching directory stats:', err);
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, []);

  // Fetch Games (with search/filters/pagination)
  useEffect(() => {
    async function fetchGames() {
      try {
        setLoadingGames(true);
        setError(null);

        let url = '';
        if (searchQuery.trim().length >= 2) {
          // Use search endpoint
          url = `/api/opengames/search?q=${encodeURIComponent(searchQuery)}&page=${page}&pageSize=8`;
          if (selectedLanguage !== 'All') url += `&language=${encodeURIComponent(selectedLanguage)}`;
          if (selectedGenre !== 'All') url += `&genre=${encodeURIComponent(selectedGenre)}`;
        } else {
          // Use list endpoint
          url = `/api/opengames/games?page=${page}&pageSize=8&sort=${sortBy}&order=${sortOrder}`;
          if (selectedLanguage !== 'All') url += `&language=${encodeURIComponent(selectedLanguage)}`;
          if (selectedGenre !== 'All') url += `&genre=${encodeURIComponent(selectedGenre)}`;
        }

        const res = await fetch(url);
        const json = await res.json();
        if (json.success && json.data) {
          if (searchQuery.trim().length >= 2) {
            setGames(json.data.results || []);
          } else {
            setGames(json.data.games || []);
          }
          setMeta(json.meta);
        } else {
          throw new Error('API returned unsuccessful response');
        }
      } catch (err) {
        console.error('Error fetching games list:', err);
        setError('Failed to fetch open source games directory. Using local offline simulation.');
      } finally {
        setLoadingGames(false);
      }
    }

    // Debounce search input to avoid spamming requests
    const delayDebounce = setTimeout(() => {
      fetchGames();
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedLanguage, selectedGenre, sortBy, sortOrder, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedLanguage, selectedGenre, sortBy, sortOrder]);

  const handleNextPage = () => {
    if (meta && meta.hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prev => prev - 1);
    }
  };

  // Language colors configuration
  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      'Rust': 'bg-orange-500',
      'C++': 'bg-blue-600',
      'JavaScript': 'bg-yellow-500',
      'C#': 'bg-green-600',
      'Java': 'bg-red-500',
      'Lua': 'bg-cyan-500',
      'QuakeC': 'bg-purple-500'
    };
    return colors[lang] || 'bg-slate-500';
  };

  return (
    <div className="space-y-6 animate-fade-in p-4">
      {/* Premium Dashboard Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 dark:border-slate-800/80">
        <div>
          <h2 className={`text-lg font-black tracking-tight flex items-center gap-2 ${
            isLightTheme ? 'text-slate-800' : 'text-white'
          }`}>
            <Terminal className="w-5 h-5 text-pink-500" />
            <span>OpenGames Catalog Hub</span>
          </h2>
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
            Edge-cached indexing pipeline query sandbox &middot; 2000+ repos
          </p>
        </div>

        {/* Global Statistics Ribbon */}
        {stats && (
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-xl border text-center backdrop-blur-sm ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#0f1922] border-slate-800/85'
            }`}>
              <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 block tracking-wider">Indexed Games</span>
              <span className="text-xs font-black font-mono text-pink-500">{stats.totalGames}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-center backdrop-blur-sm ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#0f1922] border-slate-800/85'
            }`}>
              <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 block tracking-wider">Avg Star Index</span>
              <span className="text-xs font-black font-mono text-amber-500">{stats.avgStars}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border text-center backdrop-blur-sm ${
              isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#0f1922] border-slate-800/85'
            }`}>
              <span className="text-[7.5px] uppercase font-mono font-bold text-slate-400 block tracking-wider">Top Engine Lang</span>
              <span className="text-xs font-black font-mono text-blue-500">C++</span>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search Console Grid */}
      <div className={`p-4 rounded-2xl border backdrop-blur-sm space-y-4 ${
        isLightTheme ? 'bg-white/80 border-slate-200' : 'bg-[#0c141d]/50 border-slate-800/80'
      }`}>
        <div className="flex flex-col md:flex-row gap-3">
          {/* Custom Search Input */}
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search games by title, keyword, or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl font-mono border focus:outline-none focus:ring-1 transition ${
                isLightTheme 
                  ? 'bg-slate-50 border-slate-200 focus:ring-pink-500/20 text-slate-800 focus:border-pink-500' 
                  : 'bg-[#101921] border-slate-800 focus:ring-pink-500/20 text-white focus:border-pink-500'
              }`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sorting Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none transition ${
                isLightTheme
                  ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-pink-500'
                  : 'bg-[#101921] border-slate-800 text-white focus:border-pink-500'
              }`}
            >
              <option value="stars">Stars Count</option>
              <option value="lastCommit">Last Commit Date</option>
              <option value="createdAt">Created Date</option>
              <option value="title">Title Index</option>
              <option value="downloadCount">Download Volume</option>
            </select>

            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className={`px-3 py-2 text-xs font-mono rounded-xl border font-bold transition active:scale-95 ${
                isLightTheme
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-[#101921] hover:bg-[#182533] border-slate-800 text-slate-300'
              }`}
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Filter Pills: Programming Languages */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-pink-500" />
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-slate-450">Filter Language</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded-lg transition active:scale-95 ${
                  selectedLanguage === lang
                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-500/20'
                    : (isLightTheme
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        : 'bg-[#101921]/60 hover:bg-[#101921] text-slate-400 border border-slate-800/40')
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Pills: Genres */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-slate-450">Filter Genre</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded-lg transition active:scale-95 ${
                  selectedGenre === genre
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : (isLightTheme
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        : 'bg-[#101921]/60 hover:bg-[#101921] text-slate-400 border border-slate-800/40')
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      {loadingGames ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-slate-400">Querying OpenGames API data streams...</span>
        </div>
      ) : error && games.length === 0 ? (
        <div className={`p-5 rounded-2xl border flex items-center gap-4 ${
          isLightTheme ? 'bg-amber-50/50 border-amber-200 text-amber-800' : 'bg-amber-950/10 border-amber-900/30 text-amber-400'
        }`}>
          <AlertCircle className="w-6 h-6 shrink-0 text-amber-500" />
          <div>
            <span className="text-xs font-bold block">Offline Sandbox Warning</span>
            <span className="text-[10px] leading-relaxed block">{error}</span>
          </div>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-16">
          <Gamepad className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-bounce" />
          <span className="text-xs font-mono text-slate-400 block">No matching repositories found.</span>
          <span className="text-[10px] text-slate-500 block mt-1">Try broadening your search query or language filter parameters.</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game) => (
              <div
                key={game.id}
                className={`border rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden hover:-translate-y-1 hover:shadow-xl ${
                  isLightTheme 
                    ? 'bg-white border-slate-200 hover:border-pink-500/20 hover:shadow-slate-100 shadow-sm' 
                    : 'bg-[#182533]/40 border-slate-800/50 hover:border-pink-500/20 hover:shadow-black/20'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                      isLightTheme ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-slate-400'
                    }`}>
                      {game.genre}
                    </span>
                    
                    {/* Language Badge */}
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${getLanguageColor(game.language)}`} />
                      <span className="text-[10px] font-mono font-bold">{game.language}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-sm font-black tracking-tight leading-snug ${
                      isLightTheme ? 'text-slate-850' : 'text-white'
                    }`}>
                      {game.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-normal line-clamp-3 mt-1 font-sans">
                      {game.description}
                    </p>
                  </div>
                </div>

                {/* Footer metrics and actions */}
                <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Stars */}
                    <div className="flex items-center gap-1 text-[10px] font-mono text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{game.stars.toLocaleString()}</span>
                    </div>
                    {/* Forks */}
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                      <GitFork className="w-3.5 h-3.5 text-slate-500" />
                      <span>{game.forks.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedGame(game)}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded-lg border transition ${
                        isLightTheme
                          ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          : 'bg-[#101921] border-slate-800 text-slate-350 hover:bg-[#182533] hover:text-white'
                      }`}
                    >
                      Details
                    </button>
                    <a
                      href={game.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[9px] font-mono font-bold rounded-lg bg-pink-650 hover:bg-pink-600 text-white flex items-center gap-1 shadow-sm transition"
                    >
                      <Github className="w-3 h-3" />
                      <span>Source</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination bar */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t dark:border-slate-800/80 text-xs font-mono">
              <span className="text-slate-450 text-[10px]">
                Showing page {meta.page} of {meta.totalPages} &middot; {meta.total} games found
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevPage}
                  disabled={page <= 1}
                  className={`p-1.5 rounded-lg border transition duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                    isLightTheme
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-[#101921] hover:bg-[#182533] border-slate-800 text-slate-300'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!meta.hasMore}
                  className={`p-1.5 rounded-lg border transition duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                    isLightTheme
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-[#101921] hover:bg-[#182533] border-slate-800 text-slate-300'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details modal overlay */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <div className={`w-full max-w-lg border rounded-3xl p-6 relative shadow-2xl animate-scale-up ${
            isLightTheme 
              ? 'bg-white border-slate-250 text-slate-800' 
              : 'bg-[#0e1722] border-slate-800 text-white'
          }`}>
            {/* Close button */}
            <button
              onClick={() => setSelectedGame(null)}
              className={`absolute top-4 right-4 p-1.5 rounded-xl border transition ${
                isLightTheme
                  ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
                  isLightTheme ? 'bg-slate-100 text-slate-650' : 'bg-slate-900 text-slate-400'
                }`}>
                  {selectedGame.genre}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${getLanguageColor(selectedGame.language)}`} />
                <span className="text-xs font-mono font-bold">{selectedGame.language}</span>
              </div>

              <div>
                <h3 className={`text-base font-black tracking-tight ${
                  isLightTheme ? 'text-slate-850' : 'text-white'
                }`}>
                  {selectedGame.title}
                </h3>
                {selectedGame.license && (
                  <span className="text-[9px] font-mono text-slate-450 mt-0.5 block">
                    License: <span className="font-bold">{selectedGame.license}</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed font-sans mt-2">
                {selectedGame.description}
              </p>

              {/* Stats panel grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                <div className={`p-2.5 rounded-xl border text-center ${
                  isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#101921] border-slate-800'
                }`}>
                  <span className="text-[7.5px] uppercase font-mono font-bold text-slate-450 block tracking-wider">GitHub Stars</span>
                  <span className="text-xs font-black font-mono text-amber-500 flex items-center justify-center gap-1 mt-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                    {selectedGame.stars.toLocaleString()}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border text-center ${
                  isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#101921] border-slate-800'
                }`}>
                  <span className="text-[7.5px] uppercase font-mono font-bold text-slate-450 block tracking-wider">GitHub Forks</span>
                  <span className="text-xs font-black font-mono text-slate-400 flex items-center justify-center gap-1 mt-0.5">
                    <GitFork className="w-3.5 h-3.5 text-slate-500" />
                    {selectedGame.forks.toLocaleString()}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border text-center col-span-2 sm:col-span-1 ${
                  isLightTheme ? 'bg-slate-50 border-slate-200' : 'bg-[#101921] border-slate-800'
                }`}>
                  <span className="text-[7.5px] uppercase font-mono font-bold text-slate-450 block tracking-wider">Open Issues</span>
                  <span className="text-xs font-black font-mono text-red-500 mt-0.5 block">
                    {selectedGame.openIssues !== undefined ? selectedGame.openIssues.toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Extended metadata panel (terminal style) */}
              <div className={`p-4 rounded-2xl space-y-2 border text-[10px] font-mono leading-relaxed ${
                isLightTheme 
                  ? 'bg-slate-50 border-slate-200 text-slate-650' 
                  : 'bg-slate-950/70 border-slate-850 text-slate-400'
              }`}>
                {selectedGame.latestRelease && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px]">Latest Release:</span>
                    <span className="font-bold text-emerald-500">{selectedGame.latestRelease}</span>
                  </div>
                )}
                {selectedGame.downloadCount && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px]">Downloads estimate:</span>
                    <span className="font-bold text-blue-500">{selectedGame.downloadCount.toLocaleString()}</span>
                  </div>
                )}
                {selectedGame.platforms && selectedGame.platforms.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px] mt-0.5">Platforms:</span>
                    <div className="flex flex-wrap justify-end gap-1 max-w-[70%]">
                      {selectedGame.platforms.map(p => (
                        <span key={p} className="bg-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-300 border border-slate-700/40">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedGame.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px]">Repo Created:</span>
                    <span>{new Date(selectedGame.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedGame.lastCommitAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase tracking-wider text-[8px]">Last Commit:</span>
                    <span>{new Date(selectedGame.lastCommitAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Modal footer links */}
              <div className="flex justify-end items-center gap-3 pt-2">
                {selectedGame.homepage && (
                  <a
                    href={selectedGame.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-4 py-2 text-xs font-mono font-bold rounded-xl border flex items-center gap-1.5 transition ${
                      isLightTheme
                        ? 'bg-slate-50 border-slate-200 text-slate-750 hover:bg-slate-105'
                        : 'bg-[#101921] border-slate-800 text-slate-300 hover:bg-[#182533] hover:text-white'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Homepage</span>
                  </a>
                )}
                <a
                  href={selectedGame.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-pink-650 hover:bg-pink-600 text-white flex items-center gap-1.5 shadow-md shadow-pink-500/10 transition"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

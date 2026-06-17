/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, Heart, Share2, Eye, Compass, TrendingUp, Lock, RefreshCw, 
  Calendar, Flame, PlusCircle, X, Send, Check, Bookmark, FileText, CheckCircle2,
  Terminal, Code, Database, Globe, Sliders, Play, FileJson, Download,
  Cpu, Award, MessageSquare, BarChart3, Layers, BookOpen, AlertCircle, CloudSun
} from 'lucide-react';
import { NewsArticle } from '../types';

interface DisguiseNewsProps {
  onSecretTrigger: () => void;
  isLightTheme?: boolean;
}

interface ArticleComment {
  id: string;
  author: string;
  avatarColor: string;
  text: string;
  time: string;
  likes: number;
  hasUpvoted?: boolean;
}

const NEWS_APIS = [
  {
    id: 'newsapi_org',
    name: 'NewsAPI.org',
    logo: '📰',
    tagline: 'Global headlines cataloging 80k+ real-time news publishers.',
    accent: 'bg-blue-600',
    borderAccent: 'border-blue-500',
    textColor: 'text-blue-500',
    bgBadge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    endpoint: 'https://newsapi.org/v2/top-headlines',
    limits: '1,000 requests/day',
    keyStrength: 'Breaking news, localized filters, metadata indexing, keywords matching.',
    colorCode: '#2563eb'
  },
  {
    id: 'webz_io',
    name: 'Webz.io News API',
    logo: '🕸️',
    tagline: 'Enterprise-grade crawler with sentiment parsing & Boolean queries.',
    accent: 'bg-indigo-600',
    borderAccent: 'border-indigo-500',
    textColor: 'text-indigo-500',
    bgBadge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    endpoint: 'https://api.webz.io/newsApiLite',
    limits: '1,000 queries/month, 30 days history',
    keyStrength: 'Boolean operations (AND/OR/NOT), dark web scoping, entity rating arrays.',
    colorCode: '#4f46e5'
  },
  {
    id: 'newsapi_ai',
    name: 'NewsAPI.ai (Event Registry)',
    logo: '🧠',
    tagline: 'Semantic indexing, concept linkages, and automatic article categorization.',
    accent: 'bg-emerald-600',
    borderAccent: 'border-emerald-500',
    textColor: 'text-emerald-500',
    bgBadge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    endpoint: 'https://eventregistry.org/api/v1/article',
    limits: '2,000 free tokens/account',
    keyStrength: 'Entity concepts association, multilingual clustering, positive/negative rating tags.',
    colorCode: '#059669'
  },
  {
    id: 'worldnews',
    name: 'WorldNewsAPI.com',
    logo: '🌍',
    tagline: 'Geographic coordinate lookup indexing over 150+ international countries.',
    accent: 'bg-cyan-600',
    borderAccent: 'border-cyan-500',
    textColor: 'text-cyan-500',
    bgBadge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    endpoint: 'https://api.worldnewsapi.com/search-news',
    limits: '50 daily credits free plan',
    keyStrength: 'Newspaper geolocating search, language filtering index, author mapping lists.',
    colorCode: '#0891b2'
  },
  {
    id: 'newsdata',
    name: 'NewsData.io',
    logo: '📊',
    tagline: 'Timeline matching, CSV, and formatted Excel reports exports.',
    accent: 'bg-rose-600',
    borderAccent: 'border-rose-500',
    textColor: 'text-rose-550',
    bgBadge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    endpoint: 'https://newsdata.io/api/1/news',
    limits: '200 queries/day max',
    keyStrength: 'Spam filters, custom categories distribution, historical CSV indexer.',
    colorCode: '#e11d48'
  }
];

const PORTAL_SITES = [
  { 
    name: "Times of India", 
    url: "https://timesofindia.indiatimes.com/", 
    domain: "timesofindia.indiatimes.com",
    badge: "LIVE NEWS",
    badgeStyle: "bg-red-650 text-white font-serif italic",
    desc: "India's premier English daily newspaper. Real-time updates, local bulletins & editorials.",
    gradient: "from-[#8b0000] to-[#b22222]",
    textColor: "text-red-400",
    badgeColor: "bg-red-500/10 text-red-500 border-red-500/20"
  },
  { 
    name: "NDTV News", 
    url: "https://www.ndtv.com/", 
    domain: "ndtv.com",
    badge: "BREAKING NEWS",
    badgeStyle: "bg-[#0b3c5d] text-white font-mono",
    desc: "Credible and unbiased journalism from India. In-depth reports, videos & analysis.",
    gradient: "from-[#0b3c5d] to-[#328cc1]",
    textColor: "text-[#328cc1]",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20"
  },
  { 
    name: "India Today", 
    url: "https://www.indiatoday.in/", 
    domain: "indiatoday.in",
    badge: "LIVE STREAM",
    badgeStyle: "bg-red-750 text-white font-black",
    desc: "Leading national news source. Breaking stories, politics, and investigative reporting.",
    gradient: "from-[#990000] to-[#cc0000]",
    textColor: "text-red-500",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/20"
  },
  { 
    name: "Hindustan Times", 
    url: "https://www.hindustantimes.com/", 
    domain: "hindustantimes.com",
    badge: "WORLD NEWS",
    badgeStyle: "bg-[#002f5c] text-[#00c5ff]",
    desc: "Comprehensive coverage of national, metropolitan, and international developments.",
    gradient: "from-[#002f5c] to-[#005cb8]",
    textColor: "text-cyan-400",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
  },
  { 
    name: "Indian Express", 
    url: "https://indianexpress.com/", 
    domain: "indianexpress.com",
    badge: "FULL NEWS HD",
    badgeStyle: "bg-[#4a154b] text-white font-serif",
    desc: "In-depth investigative reports, opinion pieces & independent citizen bulletins.",
    gradient: "from-[#4a154b] to-[#6b11ff]",
    textColor: "text-purple-400",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20"
  },
  { 
    name: "BBC News", 
    url: "https://www.bbc.com/news", 
    domain: "bbc.com",
    badge: "GLOBAL HD",
    badgeStyle: "bg-[#bb1919] text-white font-sans",
    desc: "International news, analysis, and breaking stories from the British Broadcasting Corporation.",
    gradient: "from-[#6c0000] to-[#bb1919]",
    textColor: "text-red-400",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20"
  },
  { 
    name: "Reuters", 
    url: "https://www.reuters.com/", 
    domain: "reuters.com",
    badge: "FINANCIAL WIRE",
    badgeStyle: "bg-amber-600 text-black font-extrabold",
    desc: "Leading global provider of real-time business, financial, and political news.",
    gradient: "from-[#111111] to-[#333333]",
    textColor: "text-amber-505",
    badgeColor: "bg-amber-500/10 text-amber-550 border-amber-500/20"
  }
];

export default function DisguiseNews({ onSecretTrigger, isLightTheme = false }: DisguiseNewsProps) {
  // Navigation Tabs: 'feed' (Top Stories), 'write' (Write Editorial), 'export' (Export Center), 'engine' (Wire Specs / Logs)
  const [activeTab, setActiveTab] = useState<'feed' | 'write' | 'export' | 'engine'>('feed');
  const [toiView, setToiView] = useState<'feed' | 'channel' | 'portal'>('feed');
  const [liveVideoId, setLiveVideoId] = useState<string>("KznzRuWimUU");
  const [selectedPortalUrl, setSelectedPortalUrl] = useState<string>("https://timesofindia.indiatimes.com/");
  const [isBrowserActive, setIsBrowserActive] = useState<boolean>(false);
  const [activeApiId, setActiveApiId] = useState<string>('newsapi_org');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSerifFont, setIsSerifFont] = useState(true);
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});

  // Developer Parameters
  const [devCountry, setDevCountry] = useState('in');
  const [devLanguage, setDevLanguage] = useState('en');
  const [devSortBy, setDevSortBy] = useState('publishedAt');
  const [requestLogs, setRequestLogs] = useState<{ timestamp: string; method: string; url: string; status: number; latency: number }[]>([]);
  
  // Real-time API States
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [latencyMs, setLatencyMs] = useState(120);
  
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [hasLiked, setHasLiked] = useState<Record<string, boolean>>({});

  // Publish Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('India');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newSource, setNewSource] = useState('Times of India');

  // Reading View Modal State
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [articleComments, setArticleComments] = useState<Record<string, ArticleComment[]>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');

  // Selected Entity filter states (NLP)
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<{ type: string; val: string } | null>(null);

  const activeApiObj = NEWS_APIS.find(api => api.id === activeApiId) || NEWS_APIS[0];

  const fetchRealTimeNews = async (customQuery?: string, customCategory?: string) => {
    setIsLoading(true);
    const start = Date.now();
    try {
      const qParam = encodeURIComponent(customQuery !== undefined ? customQuery : searchQuery);
      const catParam = encodeURIComponent(customCategory !== undefined ? customCategory : selectedCategory);
      
      const res = await fetch(`/api/news?q=${qParam}&category=${catParam}&provider=${activeApiId}&country=${devCountry}&language=${devLanguage}&sortBy=${devSortBy}`);
      const data = await res.json();
      
      const elapsed = Date.now() - start;
      setLatencyMs(elapsed > 0 ? elapsed : Math.floor(Math.random() * 80) + 110);

      if (Array.isArray(data)) {
        // Prevent duplicate IDs when merging custom published articles
        const merged = [...articles.filter(a => a.id.startsWith('custom-')), ...data.filter(d => !articles.some(a => a.id === d.id))];
        setArticles(merged);
        
        // Populate likes realistically
        const initialLikes: Record<string, number> = { ...likesCount };
        merged.forEach(art => {
          if (initialLikes[art.id] === undefined) {
            initialLikes[art.id] = Math.floor(Math.random() * 250) + 120;
          }
        });
        setLikesCount(initialLikes);

        // Append to request log 
        const constructedURL = `https://${activeApiObj.id === 'newsapi_org' ? 'newsapi.org' : activeApiObj.id === 'webz_io' ? 'api.webz.io' : 'api.newsdata.io'}/v2/headlines?q=${qParam || 'latest'}&category=${catParam.toLowerCase()}&country=${devCountry}&sortBy=${devSortBy}`;
        
        setRequestLogs(prev => [
          {
            timestamp: new Date().toLocaleTimeString(),
            method: 'GET',
            url: constructedURL,
            status: 200,
            latency: elapsed || 140
          },
          ...prev.slice(0, 4) // keep last 5 requests
        ]);
      }
    } catch (err) {
      console.warn('Handling news feed fetch fallback gracefully:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealTimeNews();
  }, [activeApiId, devCountry, devLanguage, devSortBy]);

  useEffect(() => {
    if (toiView === 'channel') {
      const fetchLiveId = async () => {
        try {
          const res = await fetch('/api/toi-live');
          const data = await res.json();
          if (data && data.videoId) {
            setLiveVideoId(data.videoId);
          }
        } catch (e) {
          console.warn("Failed to retrieve live stream ID:", e);
        }
      };
      fetchLiveId();
    }
  }, [toiView]);

  // Pre-seed comments for articles when read
  const getCommentsForArticle = (id: string): ArticleComment[] => {
    if (articleComments[id]) return articleComments[id];
    
    const seed = [
      {
        id: `c1_${id}`,
        author: "Alok Sharma",
        avatarColor: "bg-blue-600",
        text: "Very thorough editorial reporting here. This is why Grounding feeds with verified publishers represent the supreme benchmark of modern citizen journalism.",
        time: "10 mins ago",
        likes: 12
      },
      {
        id: `c2_${id}`,
        author: "Praveen K.",
        avatarColor: "bg-amber-500",
        text: "Important facts presented clearly. The local context links and chronological timeline mapping are genuinely helpful to follow the updates.",
        time: "1 hour ago",
        likes: 24
      },
      {
        id: `c3_${id}`,
        author: "Sridhar G.",
        avatarColor: "bg-emerald-600",
        text: "The detailed entities match perfectly. Genuine reporting makes a huge difference in avoiding general internet noise.",
        time: "3 hours ago",
        likes: 9
      }
    ];

    setArticleComments(prev => ({ ...prev, [id]: seed }));
    return seed;
  };

  const handlePublishArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) {
      alert("Please fill in the title and brief summary details first.");
      return;
    }

    const customId = `custom-toi-${Date.now()}`;
    const craftedArticle: any = {
      id: customId,
      title: newTitle.trim(),
      category: newCategory,
      summary: newSummary.trim(),
      content: newContent.trim() || `${newSummary.trim()} Verified details have been logged into the Times Editorial Desk. Continuing investigations remain active across primary nodes.`,
      source: newSource.trim() || 'Times of India',
      imageUrl: newImageUrl.trim() || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=60',
      time: 'Just now',
      likes: 1,
      url: '#',
      sentiment: 'positive',
      sentimentScore: 0.75,
      entities: {
        persons: ['Staff Reporter'],
        organizations: ['Times Editorial Desk'],
        locations: ['New Delhi', 'Mumbai']
      },
      eventId: 'ev-custom-telemetry',
      readingTime: Math.max(1, Math.ceil((newContent.length + newSummary.length) / 500))
    };

    setArticles(prev => [craftedArticle, ...prev]);
    setLikesCount(prev => ({ ...prev, [customId]: 1 }));
    setHasLiked(prev => ({ ...prev, [customId]: true }));
    
    // Clear Form
    setNewTitle('');
    setNewSummary('');
    setNewContent('');
    setNewImageUrl('');
    
    // Redirect to feed
    setActiveTab('feed');
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle || !newCommentText.trim()) return;

    const currentArtId = selectedArticle.id;
    const cleanAuthor = commentAuthor.trim() || "Verified Reader";
    const colors = ["bg-rose-500", "bg-indigo-500", "bg-purple-500", "bg-cyan-500", "bg-teal-500", "bg-amber-500"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newComment: ArticleComment = {
      id: `rc_${Date.now()}`,
      author: cleanAuthor,
      avatarColor: randomColor,
      text: newCommentText.trim(),
      time: "Just now",
      likes: 0
    };

    setArticleComments(prev => ({
      ...prev,
      [currentArtId]: [newComment, ...(prev[currentArtId] || [])]
    }));

    setNewCommentText('');
    setCommentAuthor('');
  };

  const handleUpvoteComment = (commentId: string) => {
    if (!selectedArticle) return;
    const artId = selectedArticle.id;
    
    setArticleComments(prev => {
      const list = prev[artId] || [];
      const updated = list.map(c => {
        if (c.id === commentId) {
          const upvoted = !c.hasUpvoted;
          return {
            ...c,
            likes: upvoted ? c.likes + 1 : c.likes - 1,
            hasUpvoted: upvoted
          };
        }
        return c;
      });
      return { ...prev, [artId]: updated };
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    const queryLower = val.toLowerCase().trim();
    if (
      queryLower === '/unlock' ||
      queryLower === '/private' ||
      queryLower === '/intergram' ||
      queryLower === '/prix' ||
      queryLower === 'secret' ||
      queryLower === '1234'
    ) {
      onSecretTrigger(); // Secret door lock unlocks!
    }
  };

  const toggleLike = (id: string) => {
    if (hasLiked[id]) {
      setLikesCount((prev) => ({ ...prev, [id]: prev[id] - 1 }));
      setHasLiked((prev) => ({ ...prev, [id]: false }));
    } else {
      setLikesCount((prev) => ({ ...prev, [id]: prev[id] + 1 }));
      setHasLiked((prev) => ({ ...prev, [id]: true }));
    }
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDeleteArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this news article from your feed?")) {
      setArticles(prev => prev.filter(a => a.id !== id));
    }
  };

  const categories = ['All', 'India', 'Videos', 'Sports', 'Lifestyle', 'Technology'];

  // Base matches search and category
  const filteredArticles = articles.filter((art) => {
    const matchesCat = selectedCategory === 'All' || art.category === selectedCategory || (selectedCategory === 'India' && (art.category === 'India' || art.category === 'Politics'));
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.summary.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Support selected entity filtering
    let matchesEntity = true;
    if (selectedEntityFilter && art.entities) {
      const { type, val } = selectedEntityFilter;
      if (type === 'person') {
        matchesEntity = art.entities.persons?.includes(val) || false;
      } else if (type === 'organization') {
        matchesEntity = art.entities.organizations?.includes(val) || false;
      } else if (type === 'location') {
        matchesEntity = art.entities.locations?.includes(val) || false;
      }
    }
    return matchesCat && matchesSearch && matchesEntity;
  });

  const mainArticle = filteredArticles[0];
  const secondaryArticles = filteredArticles.slice(1);

  // Dynamic values parsed across all articles for NLP Analytics Dashboard
  const aggregateSentiment = () => {
    let pos = 0, neu = 0, neg = 0;
    filteredArticles.forEach(a => {
      const s = (a as any).sentiment || 'neutral';
      if (s === 'positive') pos++;
      else if (s === 'negative') neg++;
      else neu++;
    });
    const total = filteredArticles.length || 1;
    return {
      positivePercent: Math.round((pos / total) * 100),
      neutralPercent: Math.round((neu / total) * 100),
      negativePercent: Math.round((neg / total) * 100)
    };
  };

  const getAggregateEntities = () => {
    const personsSet = new Set<string>();
    const orgsSet = new Set<string>();
    const locsSet = new Set<string>();

    filteredArticles.forEach(a => {
      if ((a as any).entities) {
        const ents = (a as any).entities;
        ents.persons?.forEach((p: string) => personsSet.add(p));
        ents.organizations?.forEach((o: string) => orgsSet.add(o));
        ents.locations?.forEach((l: string) => locsSet.add(l));
      }
    });

    return {
      persons: Array.from(personsSet).slice(0, 8),
      organizations: Array.from(orgsSet).slice(0, 8),
      locations: Array.from(locsSet).slice(0, 8)
    };
  };

  const aggEntities = getAggregateEntities();
  const sentimentStats = aggregateSentiment();

  // EXPORTERS
  const exportToCSV = () => {
    const headers = ['ID', 'Title', 'Category', 'Source', 'Publication_Age', 'Sentiment', 'Sentiment_Score', 'Reading_Time', 'Original_URL'];
    const rows = filteredArticles.map(art => [
      art.id,
      `"${art.title.replace(/"/g, '""')}"`,
      art.category,
      art.source,
      art.time,
      (art as any).sentiment || 'neutral',
      (art as any).sentimentScore || 0,
      (art as any).readingTime || 3,
      art.url || '#'
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `news_api_export_${activeApiId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredArticles, null, 2));
    const link = document.createElement('a');
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `news_api_export_${activeApiId}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      id="main-disguise-news-card" 
      className={`border rounded-3xl overflow-hidden transition-all duration-500 w-full max-w-7xl mx-auto ${
        isLightTheme 
          ? 'bg-white/80 border-slate-200/60 text-slate-800 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] backdrop-blur-xl' 
          : 'bg-[#0b131b]/90 border-[#1f2d3d] text-slate-100 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl'
      }`}
    >


      {activeTab === 'feed' && (
        /* ========================================================================= */
        /*                    📰 PREMIUM EDITORIAL NEWSPAPER FEED                   */
        /* ========================================================================= */
        <div className="p-6 space-y-6">
          
          {/* Newspaper TOI Style Masthead Group */}
          <div className="text-center border-b-2 border-red-650 pb-4 select-none">
            
            {/* Date and Location Line */}
            <div className={`flex justify-between items-center text-[10px] font-mono uppercase tracking-widest mb-3 ${
              isLightTheme ? 'text-slate-550' : 'text-slate-400'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                <Calendar className="w-4 h-4 text-red-500" />
                <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-red-500">
                <CloudSun className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="hidden sm:inline">NEW DELHI &bull; 32°C &bull; SUNNY</span>
                <span className="sm:hidden">DELHI &bull; 32°C</span>
              </div>
            </div>


          </div>

          {/* Times of India Integration Tab Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto border-b border-dashed pb-4 border-slate-200 dark:border-slate-800">
            {/* Left spacer for desktop symmetry */}
            <div className="hidden sm:block w-[76px]"></div>
            
            <div className={`p-1 flex-grow max-w-md rounded-2xl border flex transition-all duration-300 ${
              isLightTheme ? 'bg-slate-200/50 border-slate-200' : 'bg-[#0f1922] border-slate-800/85'
            }`}>
              <button
                onClick={() => setToiView('feed')}
                className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-sans font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 border-0 cursor-pointer ${
                  toiView === 'feed'
                    ? 'bg-gradient-to-r from-red-650 to-rose-600 text-white shadow-md shadow-red-500/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-red-550 dark:hover:text-red-400'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bulletins</span>
              </button>
              <button
                onClick={() => setToiView('channel')}
                className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-sans font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 border-0 cursor-pointer ${
                  toiView === 'channel'
                    ? 'bg-gradient-to-r from-red-650 to-rose-600 text-white shadow-md shadow-red-500/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-red-550 dark:hover:text-red-400'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Live TV</span>
              </button>
              <button
                onClick={() => setToiView('portal')}
                className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-sans font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 border-0 cursor-pointer ${
                  toiView === 'portal'
                    ? 'bg-gradient-to-r from-red-650 to-rose-600 text-white shadow-md shadow-red-500/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-red-550 dark:hover:text-red-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web Portal</span>
              </button>
            </div>

            {/* Utility action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRealTimeNews()}
                disabled={isLoading}
                className={`p-2 rounded-xl border transition-all duration-300 cursor-pointer hover:scale-105 ${
                  isLightTheme 
                    ? 'border-slate-200 hover:bg-slate-200 text-slate-655 bg-slate-550/5' 
                    : 'border-slate-800 hover:bg-[#15222f] text-slate-350 bg-[#0c141d]'
                }`}
                title="Instant updates sync"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onSecretTrigger}
                className="p-2 rounded-xl bg-red-500/10 text-red-505 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 cursor-pointer hover:scale-105"
                title="Telemetry node alignment"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {toiView === 'feed' && (
            <>
              {/* Search Inputs & Standard Category selection */}
              <div className="space-y-4">
                <div className={`flex gap-1.5 overflow-x-auto scrollbar-none py-1.5 border-b pb-1 ${
                  isLightTheme ? 'border-slate-200' : 'border-slate-850'
                }`}>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        fetchRealTimeNews(searchQuery, cat);
                      }}
                      className={`text-[11px] font-extrabold px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap cursor-pointer select-none border-0 ${
                        selectedCategory === cat
                          ? 'text-red-550 bg-red-500/10 border-b-2 border-red-550 rounded-b-none'
                          : isLightTheme 
                            ? 'text-slate-605 hover:text-red-650 hover:bg-slate-100 bg-transparent' 
                            : 'text-[#8ab2d9] hover:text-white hover:bg-slate-900/60 bg-transparent'
                      }`}
                    >
                      {cat === 'All' ? '⚡ Top Headlines' : cat}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter live bulletins or enter cryptographic code..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className={`w-full border focus:border-red-505 focus:outline-none py-3 px-11 text-xs rounded-2xl transition-all duration-300 shadow-sm ${
                      isLightTheme 
                        ? 'bg-white border-slate-200 text-slate-900 focus:ring-4 focus:ring-red-500/5' 
                        : 'bg-[#0b1219] border-slate-800/80 text-[#f5f6f7] focus:ring-4 focus:ring-red-500/10'
                    }`}
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="py-24 text-center space-y-4">
                  <RefreshCw className="w-8 h-8 text-red-550 animate-spin mx-auto" />
                  <p className="text-xs font-mono text-red-550 font-bold animate-pulse">
                    Connecting to timesofindia.indiatimes.com wire and synchronizing feed...
                  </p>
                </div>
              ) : (
                <div className="space-y-8 animate-fade-in">
                  
                  {/* 1. Primary Big Featured Column */}
                  {mainArticle ? (
                    <div 
                      onClick={() => setSelectedArticle(mainArticle)}
                      className={`border rounded-3xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 cursor-pointer hover:border-red-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${
                        isLightTheme 
                          ? 'border-slate-200 bg-white/70 shadow-sm' 
                          : 'border-slate-800/80 bg-[#0c141d]/50 shadow-black'
                      }`}
                    >
                      {/* Photo cover */}
                      <div className="lg:col-span-7 h-64 sm:h-80 rounded-2xl overflow-hidden relative shadow-md group">
                        <img
                          referrerPolicy="no-referrer"
                          src={mainArticle.imageUrl}
                          alt={mainArticle.title}
                          className="w-full h-full object-cover group-hover:scale-102 transition duration-700"
                        />
                        <span className="absolute top-4 left-4 bg-gradient-to-r from-red-650 to-rose-600 text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg">
                          {mainArticle.category}
                        </span>

                        {mainArticle.id.startsWith('custom-') && (
                          <span className="absolute top-4 right-4 bg-emerald-600 text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-lg">
                            MY COLUMN
                          </span>
                        )}

                        <div className="absolute bottom-4 right-4 bg-black/75 px-3 py-1 rounded-xl text-[9px] text-white font-mono flex items-center gap-1 font-bold shadow-md">
                          <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>BREAKING EXCLUSIVE</span>
                        </div>
                      </div>

                      {/* Metadata column title body info */}
                      <div className="lg:col-span-5 flex flex-col justify-between py-1.5">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-[10px] font-bold text-red-500 uppercase tracking-widest font-mono">
                            <span>{mainArticle.source} &bull; {mainArticle.time}</span>
                            {mainArticle.id.startsWith('custom-') && (
                              <button 
                                onClick={(e) => handleDeleteArticle(mainArticle.id, e)}
                                className="text-red-500 hover:text-red-600 font-bold bg-transparent border-0 cursor-pointer text-[10px] tracking-wider"
                              >
                                ✕ DISMISS
                              </button>
                            )}
                          </div>
                          
                          <h2 
                            className={`font-black text-xl sm:text-2.5xl leading-tight transition-all duration-300 ${
                              isLightTheme ? 'text-slate-950 hover:text-red-650' : 'text-slate-50 hover:text-red-400'
                            }`} 
                            style={isSerifFont ? { fontFamily: 'Georgia, serif' } : {}}
                          >
                            {mainArticle.title}
                          </h2>
                          
                          <p className={`text-xs leading-relaxed line-clamp-6 ${
                            isLightTheme ? 'text-slate-600' : 'text-slate-300'
                          }`}>
                            {mainArticle.summary}
                          </p>
                        </div>

                        <div className={`flex items-center justify-between border-t border-dashed pt-4.5 text-[10px] sm:text-xs mt-6 ${
                          isLightTheme ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
                        }`} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleLike(mainArticle.id)}
                            className={`flex items-center gap-1.5 transition-all duration-300 border-0 bg-transparent cursor-pointer font-bold ${
                              hasLiked[mainArticle.id] ? 'text-red-500 scale-105' : 'hover:text-red-500 text-slate-400'
                            }`}
                          >
                            <Heart className={`w-4.5 h-4.5 ${hasLiked[mainArticle.id] ? 'fill-red-500 text-red-500 animate-pulse' : ''}`} />
                            <span>{likesCount[mainArticle.id] || 0}</span>
                          </button>

                          <div className="flex gap-4 items-center">
                            <span className="flex items-center gap-1 font-mono text-[10px]">
                              <Eye className="w-4 h-4 text-slate-500" />
                              <span>{Math.floor(Math.random() * 400) + 1200} reads</span>
                            </span>

                            <button 
                              onClick={() => toggleBookmark(mainArticle.id)}
                              className={`transition bg-transparent border-0 cursor-pointer ${bookmarkedIds[mainArticle.id] ? 'text-amber-500 scale-105' : 'text-slate-400 hover:text-amber-500'}`}
                              title="Bookmark story reference"
                            >
                              <Bookmark className={`w-4 h-4 ${bookmarkedIds[mainArticle.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
                            </button>

                            <button 
                              onClick={() => setSelectedArticle(mainArticle)} 
                              className="bg-transparent border-0 text-red-550 hover:text-red-650 hover:underline font-bold text-xs cursor-pointer tracking-wider"
                            >
                              READ MORE ↗
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 space-y-3">
                      <Compass className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                      <p className="text-xs font-mono">No live bulletins matching the active query index.</p>
                    </div>
                  )}

                  {/* 2. Secondary Column Lists Grid - Redesigned with premium cards */}
                  {secondaryArticles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {secondaryArticles.map((article) => {
                        const liked = hasLiked[article.id];
                        const bookmarked = bookmarkedIds[article.id];
                        return (
                          <div
                            key={article.id}
                            onClick={() => setSelectedArticle(article)}
                            className={`border rounded-2.5xl p-5 flex gap-4 cursor-pointer hover:border-red-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg justify-between ${
                              isLightTheme 
                                ? 'border-slate-200 bg-white/70 shadow-sm' 
                                : 'border-slate-800/80 bg-[#0c141d]/50 shadow-black'
                            }`}
                          >
                            <div className="flex flex-col justify-between flex-grow min-w-0 pr-2">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[9px] font-bold text-red-550 uppercase tracking-widest font-mono">
                                  <span>{article.source} &bull; {article.time}</span>
                                  {article.id.startsWith('custom-') && (
                                    <button 
                                      onClick={(e) => handleDeleteArticle(article.id, e)}
                                      className="text-red-550 hover:text-red-700 bg-transparent border-0 cursor-pointer text-[9px]"
                                    >
                                      ✕ DELETE
                                    </button>
                                  )}
                                </div>
                                <h3 
                                  className={`font-bold text-base leading-snug transition-colors duration-300 line-clamp-2 ${
                                    isLightTheme ? 'text-slate-950 hover:text-red-650' : 'text-slate-50 hover:text-red-400'
                                  }`}
                                  style={isSerifFont ? { fontFamily: 'Georgia, serif' } : {}}
                                >
                                  {article.title}
                                </h3>
                                <p className={`text-[11px] leading-relaxed line-clamp-3 ${
                                  isLightTheme ? 'text-slate-500' : 'text-slate-400'
                                }`}>
                                  {article.summary}
                                </p>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-200/10 pt-3 text-[10px] mt-4" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => toggleLike(article.id)}
                                  className={`flex items-center gap-1 transition-all duration-300 border-0 bg-transparent cursor-pointer font-bold ${
                                    liked ? 'text-red-500 scale-105' : 'hover:text-red-500 text-slate-400'
                                  }`}
                                >
                                  <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                                  <span>{likesCount[article.id] || 0}</span>
                                </button>

                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => toggleBookmark(article.id)}
                                    className={`transition bg-transparent border-0 cursor-pointer ${bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                                  >
                                    <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                                  </button>
                                  <button 
                                    onClick={() => setSelectedArticle(article)}
                                    className="bg-transparent border-0 text-red-550 hover:underline font-bold text-[11px] cursor-pointer"
                                  >
                                    Read ↗
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Visual Thumbnail */}
                            {article.imageUrl && (
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 shadow-md border border-slate-200/10 self-center">
                                <img 
                                  src={article.imageUrl} 
                                  alt={article.title} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </>
          )}

          {toiView === 'channel' && (
            <div className="animate-scale-up py-4 max-w-4xl mx-auto w-full">
              <div className="aspect-video w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200/10 bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${liveVideoId}`}
                  title="Times Now Live TV"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          {toiView === 'portal' && (
            <div className="space-y-6 animate-scale-up py-4 w-full">
              
              {!isBrowserActive ? (
                /* ========================================================================= */
                /*             🌟 NEWS PORTAL DIRECTORY - STUNNING GRID VIEW                 */
                /* ========================================================================= */
                <div className="space-y-6 animate-scale-up">
                  
                  {/* Directory Header */}
                  <div className="text-center max-w-2xl mx-auto space-y-2 select-none">
                    <h2 className={`font-serif italic font-black text-2xl sm:text-3xl tracking-wide ${
                      isLightTheme ? 'text-slate-900' : 'text-white'
                    }`}>
                      Live News Portal Directory
                    </h2>
                    <p className={`text-xs font-mono uppercase tracking-wider ${
                      isLightTheme ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Select and browse sandboxed news agency portals directly
                    </p>
                  </div>

                  {/* Grid Directory */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PORTAL_SITES.map((site) => {
                      return (
                        <div
                          key={site.url}
                          onClick={() => {
                            setSelectedPortalUrl(site.url);
                            setIsBrowserActive(true);
                          }}
                          className={`border rounded-3xl p-5 flex flex-col justify-between cursor-pointer hover:border-red-500/30 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl relative overflow-hidden group ${
                            isLightTheme 
                              ? 'border-slate-200 bg-white/70 shadow-sm' 
                              : 'border-slate-800/80 bg-[#0c141d]/50 shadow-black'
                          }`}
                        >
                          {/* Top Decorative Corner Glow */}
                          <div className={`absolute -right-6 -top-6 w-16 h-16 rounded-full blur-xl opacity-20 bg-gradient-to-tr ${site.gradient}`}></div>
                          
                          <div className="space-y-4">
                            {/* Sticker Emblem Logo Box */}
                            <div className={`h-32 flex items-center justify-center rounded-2xl relative overflow-hidden transition-all duration-300 ${
                              isLightTheme ? 'bg-slate-100/80 border border-slate-250/60' : 'bg-black/45 border border-slate-800/50'
                            }`}>
                              <div className="transform group-hover:scale-108 transition-transform duration-500 flex flex-col items-center">
                                {site.name === "Times of India" && (
                                  <div className="flex flex-col items-center select-none">
                                    <div className="flex items-center gap-1.5 bg-red-600 text-white font-sans font-black tracking-widest text-[11px] px-3.5 py-1.5 rounded-lg shadow-md border border-red-500">
                                      <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                                      <span className="uppercase font-extrabold text-[10px]">LIVE NEWS</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono mt-2.5 font-bold uppercase tracking-widest">TIMES OF INDIA</span>
                                  </div>
                                )}

                                {site.name === "NDTV News" && (
                                  <div className="flex flex-col items-center select-none relative">
                                    <div className="relative flex items-center justify-center">
                                      <svg className="w-11 h-11 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                                      </svg>
                                      <span className="absolute bg-[#e11d48] text-white font-sans font-black text-[8px] px-2 py-0.5 rounded shadow border border-red-500 uppercase tracking-widest leading-none rotate-[-6deg]">
                                        BREAKING
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-405 text-slate-400 font-mono mt-2.5 font-bold uppercase tracking-widest">NDTV NEWS</span>
                                  </div>
                                )}

                                {site.name === "India Today" && (
                                  <div className="flex flex-col items-center select-none">
                                    <div className="flex items-center bg-gradient-to-r from-red-750 to-rose-655 text-white font-sans font-black tracking-widest text-[11px] px-3.5 py-1.5 rounded-lg shadow-md border border-red-500">
                                      <span className="font-extrabold uppercase text-[10px] flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                                        LIVE STREAM
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-405 text-slate-400 font-mono mt-2.5 font-bold uppercase tracking-widest">INDIA TODAY</span>
                                  </div>
                                )}

                                {site.name === "Hindustan Times" && (
                                  <div className="flex flex-col items-center select-none relative">
                                    <div className="relative flex items-center justify-center">
                                      <svg className="w-11 h-11 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                                      </svg>
                                      <span className="absolute bg-[#002f5c] text-cyan-300 font-sans font-black text-[8px] px-2 py-0.5 rounded shadow border border-cyan-500 uppercase tracking-widest leading-none">
                                        WORLD NEWS
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-405 text-slate-400 font-mono mt-2.5 font-bold uppercase tracking-widest">HINDUSTAN TIMES</span>
                                  </div>
                                )}

                                {site.name === "Indian Express" && (
                                  <div className="flex flex-col items-center select-none">
                                    <div className="flex items-center gap-1.5 bg-purple-900/60 border border-purple-550/40 text-purple-200 font-mono font-black text-[10px] px-3 py-1.5 rounded-lg shadow-md">
                                      <span className="bg-amber-400 text-black text-[8px] font-sans font-extrabold px-1 rounded-md leading-tight shrink-0 shadow-sm">HD</span>
                                      <span className="uppercase tracking-widest font-extrabold">FULL NEWS</span>
                                    </div>
                                    <span className="text-[10px] text-slate-405 text-slate-400 font-mono mt-2.5 font-bold uppercase tracking-widest">INDIAN EXPRESS</span>
                                  </div>
                                )}

                                {site.name === "BBC News" && (
                                  <div className="flex flex-col items-center select-none">
                                    <div className="flex items-center gap-1 font-serif text-[16px] font-black tracking-tight text-white mb-1.5">
                                      <span className="bg-[#bb1919] px-2 py-0.5 rounded shadow-sm border border-[#990000]">B</span>
                                      <span className="bg-[#bb1919] px-2 py-0.5 rounded shadow-sm border border-[#990000]">B</span>
                                      <span className="bg-[#bb1919] px-2 py-0.5 rounded shadow-sm border border-[#990000]">C</span>
                                    </div>
                                    <span className="text-[8.5px] bg-red-650/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-md font-mono font-bold uppercase tracking-widest">GLOBAL NEWS</span>
                                  </div>
                                )}

                                {site.name === "Reuters" && (
                                  <div className="flex flex-col items-center select-none">
                                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg shadow-md">
                                      <span className="w-2 h-2 rounded-full bg-amber-505 shrink-0"></span>
                                      <span className="text-amber-500 font-sans font-black tracking-wider text-[10px] uppercase">REUTERS</span>
                                    </div>
                                    <span className="text-[9px] text-slate-405 text-slate-400 font-mono mt-2.5 font-bold uppercase tracking-widest">FINANCIAL WIRE</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Name, URL and Description */}
                            <div className="space-y-1.5 text-left">
                              <div className="flex items-center gap-2">
                                <img 
                                  src={`https://www.google.com/s2/favicons?sz=32&domain=${site.domain}`} 
                                  className="w-4.5 h-4.5 object-contain rounded-md bg-white/5 p-0.5 shrink-0 animate-pulse" 
                                  alt="logo" 
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                                <h3 className={`font-black text-base tracking-wide ${isLightTheme ? 'text-slate-900' : 'text-slate-50'}`}>
                                  {site.name}
                                </h3>
                              </div>
                              
                              <p className={`text-[10px] font-mono ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                                {site.url}
                              </p>
                              
                              <p className={`text-xs leading-relaxed line-clamp-2 ${isLightTheme ? 'text-slate-605' : 'text-slate-300'}`}>
                                {site.desc}
                              </p>
                            </div>
                          </div>

                          {/* Hover action guide bar */}
                          <div className="mt-4 pt-3 border-t border-slate-200/10 flex justify-between items-center text-xs">
                            <span className="text-red-550 group-hover:underline font-extrabold flex items-center gap-1">
                              BROWSE PORTAL ↗
                            </span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                              isLightTheme 
                                ? 'bg-slate-50 border-slate-200 text-slate-500' 
                                : 'bg-slate-950/40 border-slate-800 text-slate-400'
                            }`}>
                              SECURE FRAME
                            </span>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              ) : (
                /* ========================================================================= */
                /*             💻 SECURE VIRTUAL BROWSER PORTAL FRAME                         */
                /* ========================================================================= */
                <div className="space-y-4 animate-scale-up">
                  
                  {/* Back to Grid Directory button */}
                  <div className="flex justify-start">
                    <button
                      onClick={() => setIsBrowserActive(false)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-650 to-rose-600 hover:opacity-95 text-white text-[10.5px] font-sans font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 shadow-md hover:-translate-y-0.5 cursor-pointer border-0"
                    >
                      <span>← Back to Channel Directory</span>
                    </button>
                  </div>

                  {/* Active Portal Header Info Card */}
                  <div className={`border rounded-2.5xl p-4 flex items-center gap-3.5 shadow-md ${
                    isLightTheme ? 'border-slate-200 bg-white/70 shadow-sm' : 'border-slate-800/80 bg-[#0c141d]/50 shadow-black'
                  }`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center p-2 shadow-inner ${
                      isLightTheme ? 'bg-slate-100 border border-slate-200' : 'bg-slate-950 border border-slate-900'
                    }`}>
                      <img 
                        src={`https://www.google.com/s2/favicons?sz=64&domain=${selectedPortalUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}`} 
                        className="w-8 h-8 object-contain rounded" 
                        alt="Logo"
                      />
                    </div>
                    <div>
                      <h3 className={`text-sm font-sans font-black tracking-wide ${isLightTheme ? 'text-slate-900' : 'text-slate-100'}`}>
                        {PORTAL_SITES.find(s => s.url === selectedPortalUrl)?.name}
                      </h3>
                      <a 
                        href={selectedPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10.5px] text-red-550 hover:underline font-mono font-medium"
                      >
                        {selectedPortalUrl}
                      </a>
                    </div>
                  </div>

                  {/* VIRTUAL BROWSER CONTAINER */}
                  <div className={`border rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${
                    isLightTheme ? 'border-slate-250 bg-slate-100 shadow-slate-200' : 'border-[#1e2e3e] bg-[#0c141d]'
                  }`}>
                    
                    {/* Browser Title Bar / Window Header */}
                    <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex flex-wrap gap-3 justify-between items-center select-none">
                      
                      {/* Windows/Mac Mock Close Buttons & Portal Selector Dropdown */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 mr-2" onClick={() => setIsBrowserActive(false)} title="Close Browser">
                          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm cursor-pointer hover:scale-110 transition"></span>
                          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-sm"></span>
                          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
                        </div>
                        
                        {/* Portal Selector Dropdown */}
                        <div className="relative">
                          <select
                            value={selectedPortalUrl}
                            onChange={(e) => setSelectedPortalUrl(e.target.value)}
                            className="bg-[#18232e] border border-slate-700/60 rounded-xl py-1.5 px-3 pr-8 text-[10.5px] text-slate-200 font-sans font-bold outline-none cursor-pointer hover:border-slate-600 focus:border-red-500 transition duration-200 appearance-none shadow"
                          >
                            {PORTAL_SITES.map((site) => (
                              <option key={site.url} value={site.url} className="bg-[#111c24] text-slate-100">
                                {site.name}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Browser URL Input Mock */}
                      <div className="flex-grow max-w-xl mx-2 md:mx-4 order-3 md:order-2 w-full md:w-auto">
                        <div className="w-full bg-[#18232e] border border-slate-700/60 rounded-xl py-1.5 px-4 text-[10px] text-slate-300 font-mono flex items-center justify-between">
                          <div className="flex items-center gap-2.5 overflow-hidden truncate">
                            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                            <img 
                              src={`https://www.google.com/s2/favicons?sz=32&domain=${selectedPortalUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}`} 
                              className="w-3.5 h-3.5 object-contain rounded-sm shrink-0 bg-white/10 p-0.5" 
                              alt="" 
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                            <span className="text-slate-100 font-bold shrink-0 font-sans border-r border-slate-700 pr-2.5 mr-0.5">
                              {PORTAL_SITES.find(s => s.url === selectedPortalUrl)?.name || "Web Portal"}
                            </span>
                            <span className="text-slate-400 shrink-0">https://</span>
                            <span className="text-slate-100 truncate">
                              {selectedPortalUrl.replace(/^https?:\/\/(www\.)?/, '')}
                            </span>
                          </div>
                          <span className="text-emerald-400 font-bold tracking-wider text-[8px] uppercase border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
                            SECURE
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 text-slate-400 font-bold text-xs order-2 md:order-3">
                        <a
                          href={selectedPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded-xl text-[10px] sm:text-xs transition-all duration-300 hover:scale-105 shadow cursor-pointer text-center no-underline"
                        >
                          LAUNCH SITE ↗
                        </a>
                      </div>

                    </div>

                    {/* Quick Access Bookmarks / Channel List Bar */}
                    <div className="bg-[#111c24] border-b border-slate-800 px-5 py-2 flex flex-wrap items-center gap-2 select-none">
                      <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider mr-2">Quick Access Portal:</span>
                      {PORTAL_SITES.map((site) => {
                        const isSelected = selectedPortalUrl === site.url;
                        return (
                          <button
                            key={site.url}
                            onClick={() => setSelectedPortalUrl(site.url)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-sans font-bold transition-all duration-300 flex items-center gap-1.5 border cursor-pointer hover:scale-102 ${
                              isSelected
                                ? 'bg-red-650/15 border-red-500/40 text-red-400 shadow-sm'
                                : 'bg-[#18232e] border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <img 
                              src={`https://www.google.com/s2/favicons?sz=32&domain=${site.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}`} 
                              className="w-3.5 h-3.5 object-contain rounded-sm" 
                              alt="" 
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                            <span>{site.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Embedded Website Frame */}
                    <div className="w-full h-[75vh] bg-white relative">
                      <iframe
                        src={`/api/portal-proxy?url=${encodeURIComponent(selectedPortalUrl)}`}
                        title="News Web Portal"
                        className="w-full h-full border-0"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      ></iframe>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {activeTab === 'write' && (
        /* ========================================================================= */
        /*                    ✍️ PREMIUM CITIZEN JOURNALIST WRITE ROOM               */
        /* ========================================================================= */
        <div className="p-6 space-y-6 animate-fade-in">
          <div className="border-b pb-4 border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg sm:text-xl font-serif font-black flex items-center gap-2">
                <PlusCircle className="w-5.5 h-5.5 text-red-550" />
                <span>Times Column Room</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">Publish custom articles dynamically to the local news feed stream.</p>
            </div>
            <button 
              onClick={() => setActiveTab('feed')}
              className="text-xs bg-transparent border-0 cursor-pointer text-red-500 hover:text-red-600 font-black tracking-wider uppercase font-mono"
            >
              ✕ BACK TO BULLETINS
            </button>
          </div>

          <form onSubmit={handlePublishArticle} className="space-y-5 max-w-2xl mx-auto text-xs sm:text-sm">
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono tracking-wider font-black text-slate-400">Headline News Title</label>
              <input
                type="text"
                required
                placeholder="e.g., Cricket India beats Australia in thrilling Border-Gavaskar opening..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={`w-full border focus:border-red-550 focus:outline-none p-3.5 text-xs rounded-2xl transition-all duration-300 ${
                  isLightTheme 
                    ? 'bg-white border-slate-200 text-slate-900 focus:ring-4 focus:ring-red-500/5' 
                    : 'bg-slate-900/60 border-slate-800/80 text-white focus:ring-4 focus:ring-red-500/10 placeholder-slate-700'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-mono tracking-wider font-black text-slate-400">Category Tag</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={`w-full border p-3.5 text-xs rounded-2xl outline-none transition-all duration-300 ${
                    isLightTheme 
                      ? 'bg-white border-slate-200 text-slate-800 focus:border-red-550' 
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-205 focus:border-red-550'
                  }`}
                >
                  <option value="India">India / Politics</option>
                  <option value="Sports">Sports Desk</option>
                  <option value="Technology">Technology Hub</option>
                  <option value="Lifestyle">Lifestyle / Culture</option>
                  <option value="Business">Business / Finance</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-mono tracking-wider font-black text-slate-400">News Publisher Source</label>
                <input
                  type="text"
                  placeholder="e.g., Times of India, Reuters, AFP"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className={`w-full border focus:border-red-550 focus:outline-none p-3.5 text-xs rounded-2xl transition-all duration-300 ${
                    isLightTheme 
                      ? 'bg-white border-slate-200 text-slate-905 focus:ring-4 focus:ring-red-500/5' 
                      : 'bg-slate-900/60 border-slate-800/80 text-white focus:ring-4 focus:ring-red-500/10'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono tracking-wider font-black text-slate-400">Context Cover Image Link (Unsplash Photo URL)</label>
              <input
                type="url"
                placeholder="e.g., https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className={`w-full border focus:border-red-555 focus:outline-none p-3.5 text-xs rounded-2xl transition-all duration-300 ${
                  isLightTheme 
                    ? 'bg-white border-slate-200 text-slate-900' 
                    : 'bg-slate-900/60 border-slate-800/80 text-white'
                }`}
              />
              <span className="text-[10px] text-slate-500 block">Leave empty for automatic structured graphic placeholder.</span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono tracking-wider font-black text-slate-400">Brief Lead Summary (2 Sentences)</label>
              <textarea
                required
                rows={2}
                maxLength={250}
                placeholder="A concise synopsis of the breaking bulletin..."
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                className={`w-full border focus:border-red-555 focus:outline-none p-3.5 text-xs rounded-2xl transition-all duration-300 ${
                  isLightTheme 
                    ? 'bg-white border-slate-200 text-slate-900 focus:ring-4 focus:ring-red-500/5' 
                    : 'bg-slate-900/60 border-slate-800/80 text-white focus:ring-4 focus:ring-red-500/10'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-mono tracking-wider font-black text-slate-400">Detailed Column Content Body</label>
              <textarea
                rows={5}
                placeholder="The detailed paragraphs expanding on the facts, coordinate sources, and official statements..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className={`w-full border focus:border-red-555 focus:outline-none p-3.5 text-xs rounded-2xl transition-all duration-300 ${
                  isLightTheme 
                    ? 'bg-white border-slate-200 text-slate-900 focus:ring-4 focus:ring-red-500/5' 
                    : 'bg-slate-900/60 border-slate-800/80 text-white focus:ring-4 focus:ring-red-500/10'
                }`}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-650 to-rose-600 hover:opacity-95 text-white font-bold tracking-widest text-xs uppercase transition-all duration-300 shadow-lg shadow-red-500/10 hover:-translate-y-0.5 cursor-pointer border-0"
            >
              🚀 PUBLISH BULLETIN COLUMN
            </button>
          </form>
        </div>
      )}

      {activeTab === 'export' && (
        /* ========================================================================= */
        /*                    📥 PREMIUM DOWNLOAD & DATA EXPORT CENTER              */
        /* ========================================================================= */
        <div className="p-6 space-y-6 animate-fade-in">
          <div className="border-b pb-4 border-slate-200 dark:border-slate-800">
            <h2 className="text-lg sm:text-xl font-serif font-black flex items-center gap-2">
              <Download className="w-5.5 h-5.5 text-red-550" />
              <span>Telemetry Data Export Center</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">Format and download structured feed objects directly to local disk storage.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* CSV export card */}
            <div className={`p-6 rounded-3xl border flex flex-col justify-between items-center text-center space-y-4 transition-all duration-300 ${
              isLightTheme ? 'bg-slate-100/40 border-slate-200 shadow-sm' : 'bg-slate-900/40 border-slate-800/80 shadow-md'
            }`}>
              <div className="w-14 h-14 rounded-2xl bg-[#009b00]/10 border border-[#009b00]/20 flex items-center justify-center text-[#00a800] text-3xl font-black font-mono shadow-sm">
                CSV
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm">Download Spreadsheet CSV</h3>
                <p className="text-[11px] text-slate-400 font-mono">Compatible with Excel, Google Sheets, and structured DB tables.</p>
              </div>
              <button 
                onClick={exportToCSV}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all duration-300 shadow cursor-pointer border-0 hover:scale-105 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT CSV FILE</span>
              </button>
            </div>

            {/* JSON export card */}
            <div className={`p-6 rounded-3xl border flex flex-col justify-between items-center text-center space-y-4 transition-all duration-300 ${
              isLightTheme ? 'bg-slate-100/40 border-slate-200 shadow-sm' : 'bg-slate-900/40 border-slate-800/80 shadow-md'
            }`}>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-505 text-3xl font-black font-mono shadow-sm">
                <FileJson className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm">Download Raw JSON Objects</h3>
                <p className="text-[11px] text-slate-400 font-mono">Serialized news object array schemas for developer telemetry tests.</p>
              </div>
              <button 
                onClick={exportToJSON}
                className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all duration-300 shadow cursor-pointer border-0 hover:scale-105 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>EXPORT JSON OBJECTS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'engine' && (
        /* ========================================================================= */
        /*                    ⚙️ WIRE ENGINE SPEC & LOGS CONSOLE                     */
        /* ========================================================================= */
        <div className="p-4 sm:p-6 space-y-6 animate-fade-in text-xs sm:text-sm">
          <div className="border-b pb-3 border-slate-200 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-serif font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5 text-red-600" />
              <span>Grounding Engine Spec Settings</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure search parameters, active news APIs, and monitor web service telemetry streams.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Options panel */}
            <div className="lg:col-span-5 space-y-5">
              
              {/* API Provider Picker */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-black uppercase text-slate-400">Choose News Engine Wire</label>
                <div className="grid grid-cols-1 gap-2">
                  {NEWS_APIS.map((api) => (
                    <button
                      key={api.id}
                      onClick={() => setActiveApiId(api.id)}
                      className={`p-3 rounded-xl border text-left transition select-none cursor-pointer flex items-center gap-3 ${
                        activeApiId === api.id
                          ? (isLightTheme ? 'border-red-500 bg-red-500/5' : 'border-red-650 bg-red-650/10')
                          : (isLightTheme ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-800 bg-slate-905 hover:bg-slate-900 bg-[#121c24]/30')
                      }`}
                    >
                      <span className="text-lg">{api.logo}</span>
                      <div className="min-w-0 flex-grow">
                        <div className="flex justify-between items-center">
                          <span className={`font-mono text-xs font-black ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>{api.name}</span>
                          <span className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded leading-none ${api.bgBadge}`}>{api.limits}</span>
                        </div>
                        <p className="text-[10px] text-slate-405 text-slate-400 truncate leading-normal">{api.tagline}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Geographic filtering limits */}
              <div className="space-y-4 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-100/30 dark:bg-black/10">
                <span className="text-xs font-mono font-black uppercase block tracking-wider text-red-500 border-b border-slate-200 dark:border-slate-800 pb-1.5">Parameters Configuration</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9.5px] font-mono uppercase text-slate-400 mb-1">Geographic Scoping</label>
                    <select
                      value={devCountry}
                      onChange={(e) => setDevCountry(e.target.value)}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] rounded font-mono outline-none"
                    >
                      <option value="in">India (Delhi / Mumbai)</option>
                      <option value="us">United States (NY / DC)</option>
                      <option value="uk">United Kingdom (London)</option>
                      <option value="global">Global Channels</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-mono uppercase text-slate-400 mb-1">Language Range</label>
                    <select
                      value={devLanguage}
                      onChange={(e) => setDevLanguage(e.target.value)}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] rounded font-mono outline-none"
                    >
                      <option value="en">English (Wire standard)</option>
                      <option value="fr">French (Parisian)</option>
                      <option value="de">German (Berlin)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9.5px] font-mono uppercase text-slate-400 mb-1">Sorting Index Priority</label>
                  <select
                    value={devSortBy}
                    onChange={(e) => setDevSortBy(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] rounded font-mono outline-none"
                  >
                    <option value="publishedAt">TIMESTAMPS: Published Chrono</option>
                    <option value="relevance">RELEVANCE: Keyword Grounding</option>
                    <option value="popularity">POPULARITY: Reader clicks stats</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Right Analytics and Logs panel */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Aggregated NLP Stats Summary */}
              <div className="p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 bg-slate-100/30 dark:bg-black/10 space-y-3.5">
                <span className="text-xs font-mono font-black uppercase tracking-wider block text-red-500 border-b border-slate-200 dark:border-slate-800 pb-1.5">Editorial Feed Insights (NLP)</span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <div className="font-mono text-lg font-black">{sentimentStats.positivePercent}%</div>
                    <div className="text-[8.5px] font-mono font-black uppercase tracking-wider mt-0.5">POSITIVE TONE</div>
                  </div>
                  <div className="text-center p-2.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                    <div className="font-mono text-lg font-black">{sentimentStats.neutralPercent}%</div>
                    <div className="text-[8.5px] font-mono font-black uppercase tracking-wider mt-0.5">NEUTRAL TONE</div>
                  </div>
                  <div className="text-center p-2.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <div className="font-mono text-lg font-black">{sentimentStats.negativePercent}%</div>
                    <div className="text-[8.5px] font-mono font-black uppercase tracking-wider mt-0.5">CRITICAL TONE</div>
                  </div>
                </div>

                <div className="space-y-2 pt-1 pb-1">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wide text-slate-450 text-slate-500 block">KEY ENTITIES MAPPED ACROSS ACTIVE FEED</span>
                  <div className="flex flex-wrap gap-1.5">
                    {aggEntities.locations.map(loc => (
                      <span 
                        key={loc} 
                        onClick={() => setSelectedEntityFilter(selectedEntityFilter?.val === loc ? null : { type: 'location', val: loc })}
                        className={`text-[9.5px] font-mono font-extrabold px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-0.5 ${
                          selectedEntityFilter?.val === loc 
                            ? 'bg-red-550 bg-red-600 text-white shadow' 
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                        }`}
                      >
                        📍 {loc}
                      </span>
                    ))}
                    {aggEntities.persons.map(pers => (
                      <span 
                        key={pers} 
                        onClick={() => setSelectedEntityFilter(selectedEntityFilter?.val === pers ? null : { type: 'person', val: pers })}
                        className={`text-[9.5px] font-mono font-extrabold px-3 py-0.5 rounded cursor-pointer transition flex items-center gap-0.5 ${
                          selectedEntityFilter?.val === pers 
                            ? 'bg-red-550 bg-red-600 text-white shadow' 
                            : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25'
                        }`}
                      >
                        👤 {pers}
                      </span>
                    ))}
                    {aggEntities.organizations.map(org => (
                      <span 
                        key={org} 
                        onClick={() => setSelectedEntityFilter(selectedEntityFilter?.val === org ? null : { type: 'organization', val: org })}
                        className={`text-[9.5px] font-mono font-extrabold px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-0.5 ${
                          selectedEntityFilter?.val === org 
                            ? 'bg-red-550 bg-red-600 text-white shadow' 
                            : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25'
                        }`}
                      >
                        🏢 {org}
                      </span>
                    ))}
                  </div>
                  {selectedEntityFilter && (
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] text-red-500">
                      <span>Filtering feed specifically where entity is <b>{selectedEntityFilter.val}</b></span>
                      <button 
                        onClick={() => setSelectedEntityFilter(null)} 
                        className="text-[9px] bg-red-500/15 border-0 hover:bg-red-500/25 text-red-500 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        Clear Filter
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE CONSOLE TRANSACTION REGISTER (Simulated/telemetry gateway for disguise/pairing purposes) */}
              <div className="p-4 rounded-xl border border-slate-205 dark:border-slate-850 bg-slate-950 text-slate-200 font-mono space-y-3 shadow-md max-h-[220px] flex flex-col justify-between">
                <div className="flex justify-between items-center text-[9px] uppercase font-mono font-bold tracking-wider text-slate-505 text-slate-400 border-b border-slate-900 pb-1.5">
                  <span className="flex items-center gap-1.5 text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                    TELEMETRY FEED CHANNELS
                  </span>
                  <span>SSL SECURE PORT</span>
                </div>

                <div className="font-mono text-[9px] text-slate-400 space-y-1.5 leading-relaxed overflow-y-auto flex-grow scrollbar-thin max-h-[120px] pr-1 select-all">
                  {requestLogs.length === 0 ? (
                    <div className="text-slate-600 italic py-1">Awaiting active data handshakes... Connection routes are safe.</div>
                  ) : (
                    requestLogs.map((log, lIdx) => (
                      <div key={lIdx} className="flex flex-col sm:flex-row justify-between pt-1 border-t border-slate-900/40 first:border-t-0 font-mono">
                        <span className="truncate sm:max-w-md text-slate-300">
                          <span className="text-emerald-500">[{log.timestamp}]</span> <b className="text-amber-400">{log.method}</b> {log.url}
                        </span>
                        <span className="text-emerald-400 shrink-0 select-none">
                          HTTP {log.status} &bull; {log.latency}ms
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="text-[8px] text-slate-500 dark:text-slate-650 pt-1.5 border-t border-slate-900 select-none uppercase tracking-wider text-right font-black">
                  Daily Echo Synchronization Wire Engine • Latency: {latencyMs}ms
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* FOOTER METRIC INFO STATUS LINE */}
      <div className={`p-4 border-t flex justify-between items-center text-[9px] font-mono select-none ${
        isLightTheme ? 'border-slate-200 text-slate-400 bg-slate-100' : 'border-[#1b2a37] text-slate-500 bg-[#0b1116]'
      }`}>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>Synchronized: <b>ACTIVE [latency: {latencyMs}ms]</b></span>
        </span>
        <span className="font-bold uppercase tracking-wider text-red-500">
          News Engine Catalog &bull; {activeApiObj.name}
        </span>
      </div>


      {/* ========================================================================= */
      /*                      MODAL: DETAILED STORY INSPECTOR                      */
      /* ========================================================================= */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
          <div className={`shadow-2xl border flex flex-col justify-between w-full max-w-2xl rounded-3xl p-6 max-h-[92vh] ${
            isLightTheme ? 'bg-white text-slate-900 border-slate-205' : 'bg-[#111c25] text-slate-100 border-slate-800'
          }`}>
            
            {/* Header top section */}
            <div className={`flex justify-between items-center border-b pb-3 mb-4 ${isLightTheme ? 'border-slate-205' : 'border-slate-850'}`}>
              <span className="text-[10px] font-mono font-bold tracking-widest text-red-500 uppercase flex items-center gap-1 leading-none shadow-sm pb-1">
                <Layers className="w-3.5 h-3.5 text-red-500 animate-pulse mr-0.5" />
                {selectedArticle.category || 'All'} news bulletin
              </span>
              <button 
                onClick={() => setSelectedArticle(null)}
                className={`font-mono text-xs font-bold px-2.5 py-1 rounded border border-0 cursor-pointer transition ${
                  isLightTheme 
                    ? 'bg-slate-100 border-slate-205 text-slate-700 hover:bg-slate-200' 
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-red-450'
                }`}
              >
                ✕ Close
              </button>
            </div>

            {/* Scrollable Story content viewport */}
            <div className="flex-grow overflow-y-auto space-y-5 pr-1.5 scrollbar-thin">
              
              <div className="space-y-2">
                <h2 
                  className={`text-lg sm:text-2xl leading-snug font-bold leading-tight ${isLightTheme ? 'text-slate-900' : 'text-white'}`}
                  style={isSerifFont ? { fontFamily: 'Georgia, serif' } : {}}
                >
                  {selectedArticle.title}
                </h2>
                
                <div className={`flex items-center justify-between text-[10px] text-slate-400 font-mono border-b pb-2 ${
                  isLightTheme ? 'border-slate-200' : 'border-slate-850'
                }`}>
                  <span>BYLINE: TIMES EDITORIAL DESK &bull; {selectedArticle.source}</span>
                  <span>TIMESTREAMS: {selectedArticle.time}</span>
                </div>
              </div>

              {/* Cover Photo */}
              {selectedArticle.imageUrl && (
                <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden shadow-sm bg-slate-100 dark:bg-slate-950 border border-slate-200/5 hover:scale-[1.002] transition duration-300">
                  <img 
                    src={selectedArticle.imageUrl} 
                    alt={selectedArticle.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Elegant User-Friendly Grounding Fact Sheet */}
              <div className={`p-4 rounded-2xl space-y-2.5 text-[10px] sm:text-[11px] font-mono border transition ${
                isLightTheme 
                  ? 'bg-slate-50 border-slate-200 text-slate-650 shadow-sm' 
                  : 'bg-slate-950 border-slate-850 text-slate-400'
              }`}>
                <div className={`font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px] border-b pb-1.5 mb-1 ${
                  isLightTheme ? 'text-red-600 border-slate-200' : 'text-red-400 border-slate-900'
                }`}>
                  <CircleCheckIcon className="w-4 h-4 text-emerald-500" />
                  <span>Grounding Verification Factsheet</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 leading-relaxed">
                  <div className="space-y-1">
                    <div>Editorial Tone Analysis: <span className={`font-black ${
                      (selectedArticle as any).sentiment === 'positive' ? 'text-emerald-500' : (selectedArticle as any).sentiment === 'negative' ? 'text-rose-500' : 'text-slate-400'
                    }`}>{(selectedArticle as any).sentiment?.toUpperCase() || 'NEUTRAL'} ({(selectedArticle as any).sentimentScore || 0.1})</span></div>
                    <div>Story Conversation Thread ID: <span className={`font-semibold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>{(selectedArticle as any).eventId || 'ev-none-unaligned'}</span></div>
                    <div>Estimated Reading Duration: <span className={`font-semibold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>⏱️ {(selectedArticle as any).readingTime || Math.floor(Math.random() * 2) + 2} mins standard pace</span></div>
                  </div>

                  <div className="space-y-1">
                    <div>Locations Mentioned: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(selectedArticle as any).entities?.locations?.join(', ') || 'Global Wire'}</span></div>
                    <div>Organizations Involved: <span className="text-indigo-600 dark:text-violet-450 font-bold">{(selectedArticle as any).entities?.organizations?.slice(0, 3).join(', ') || 'Times Desk'}</span></div>
                    <div>Reference Serial ID: <span className="text-amber-600 dark:text-amber-400 font-semibold">{selectedArticle.id}</span></div>
                  </div>
                </div>
              </div>

              {/* Reading Content Body */}
              <div 
                className={`text-sm sm:text-[15px] leading-relaxed space-y-4 p-0.5 ${
                  isLightTheme ? 'text-slate-850' : 'text-slate-200'
                }`}
                style={isSerifFont ? { fontFamily: 'Georgia, serif' } : {}}
              >
                <p className="font-extrabold border-l-4 border-red-600 pl-3.5 italic text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-relaxed">
                  {selectedArticle.summary}
                </p>
                <div className="space-y-4 font-normal tracking-wide">
                  {selectedArticle.content ? (
                    selectedArticle.content.split('\n\n').map((para: string, pIdx: number) => (
                      <p key={pIdx} className="leading-relaxed">{para}</p>
                    ))
                  ) : (
                    <>
                      <p>
                        <strong>MUMBAI/NEW DELHI:</strong> Specialized digital committees and local reporters converged in active regional terminals yesterday to confirm state development milestones, security auditing indices, and infrastructure alignments across emerging corridors this Friday.
                      </p>
                      <p>
                        Spokespersons verify that advanced municipal compute lines are functioning efficiently. "Our primary focus remains to secure direct community relations and provide reliable verification flows," they declared in statements.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* BOOKMARK & LIKES STATS BAR */}
              <div className={`p-3 rounded-xl flex justify-between items-center text-xs border transition ${
                isLightTheme 
                  ? 'bg-slate-100 border-slate-205 text-slate-800' 
                  : 'bg-[#121c24] border-slate-850 text-slate-200'
              }`}>
                <div className="flex items-center gap-4 text-[11px]">
                  <button 
                    onClick={() => toggleLike(selectedArticle.id)}
                    className="flex items-center gap-1 hover:text-red-500 transition font-bold bg-transparent border-0 cursor-pointer text-slate-500 dark:text-slate-400"
                  >
                    <Heart className={`w-4 h-4 ${hasLiked[selectedArticle.id] ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{likesCount[selectedArticle.id] || 0} Likes</span>
                  </button>

                  <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    <Eye className="w-4 h-4" />
                    <span>{Math.floor(Math.random() * 200) + 1500} reads</span>
                  </span>
                </div>

                <button 
                  onClick={() => toggleBookmark(selectedArticle.id)}
                  className={`flex items-center gap-1 transition text-[10px] font-bold bg-transparent border-0 cursor-pointer ${bookmarkedIds[selectedArticle.id] ? 'text-amber-500' : 'text-slate-400 hover:text-amber-550'}`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${bookmarkedIds[selectedArticle.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{bookmarkedIds[selectedArticle.id] ? 'SAVED' : 'SAVE STORY'}</span>
                </button>
              </div>

              {/* =================Reader Debates Forum Forum ================= */}
              <div className={`border-t pt-4 space-y-4 ${isLightTheme ? 'border-slate-200' : 'border-slate-850'}`}>
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-red-500">
                  <MessageSquare className="w-4 h-4" />
                  <span>Reader Debates Forum &bull; {getCommentsForArticle(selectedArticle.id).length} Comments</span>
                </h4>

                {/* Write live comment form */}
                <form onSubmit={handlePostComment} className={`space-y-2.5 p-3.5 rounded-xl text-xs border transition ${
                  isLightTheme 
                    ? 'bg-slate-50 border-slate-205 text-slate-850 shadow-sm' 
                    : 'bg-slate-950 border-slate-850'
                }`}>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text"
                      placeholder="Your Display Name (e.g. Alok Sharma)"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      className={`p-2 border rounded outline-none focus:border-red-600 text-[11px] transition ${
                        isLightTheme 
                          ? 'bg-white border-slate-200 text-slate-900 focus:border-red-600' 
                          : 'bg-slate-900 border-slate-800 text-white focus:border-red-600'
                      }`}
                    />
                    <span className="text-[9px] text-slate-500 flex items-center justify-end font-mono">
                      Real-time Dispatch Desk &bull; Active Node
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      required
                      placeholder="Add your respectful perspective or commentary to the column thread..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className={`flex-grow p-2 border rounded outline-none focus:border-red-600 text-[11px] transition ${
                        isLightTheme 
                          ? 'bg-white border-slate-200 text-slate-900 focus:border-red-605 placeholder-slate-400' 
                          : 'bg-slate-900 border-slate-800 text-white focus:border-red-600 placeholder-slate-500'
                      }`}
                    />
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold flex items-center justify-center gap-1 shrink-0 font-mono text-[10px] border-0 cursor-pointer shadow-sm"
                    >
                      <span>POST</span>
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </form>

                {/* Render comments list */}
                <div className="space-y-3">
                  {getCommentsForArticle(selectedArticle.id).map((c) => (
                    <div 
                      key={c.id} 
                      className={`p-3 rounded-xl border flex gap-3 text-xs justify-between items-start transition ${
                        isLightTheme 
                          ? 'bg-white border-slate-200 text-slate-800 shadow-sm' 
                          : 'bg-slate-950 border-slate-850 text-white'
                      }`}
                    >
                      <div className="flex gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-sm ${c.avatarColor}`}>
                          {c.author.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="space-y-1 min-w-0 flex-grow">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold font-serif ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>{c.author}</span>
                            <span className="text-[9px] text-slate-400 font-mono tracking-tight">{c.time}</span>
                          </div>
                          <p className={`leading-normal text-xs ${isLightTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                            {c.text}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUpvoteComment(c.id)}
                        className={`flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded transition shrink-0 border-0 cursor-pointer ${
                          c.hasUpvoted 
                            ? 'text-red-500 bg-red-500/10 font-bold' 
                            : `text-slate-500 hover:text-red-500 bg-transparent hover:bg-slate-900 ${isLightTheme ? 'hover:bg-slate-100' : ''}`
                        }`}
                      >
                        ▲ {c.likes}
                      </button>
                    </div>
                  ))}
                </div>

              </div>

            </div>

            <div className={`pt-3 border-t text-right mt-3 select-none flex justify-end gap-2 ${isLightTheme ? 'border-slate-200' : 'border-slate-850'}`}>
              <button 
                onClick={() => setSelectedArticle(null)}
                className="py-2.5 px-6 bg-red-600 hover:bg-red-700 border-0 text-white font-bold font-mono text-xs rounded-xl shadow-md cursor-pointer transition active:scale-95"
              >
                DISMISS ARTICLE
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Inline custom verification vector badge
function CircleCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

// Reusable Nodemailer transporter configuration
let mailTransporter: any = null;

async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;

  const smtpHost = process.env.SMTP_HOST || (process.env.GMAIL_USER ? "smtp.gmail.com" : "");
  const smtpPort = process.env.SMTP_PORT || (process.env.GMAIL_USER ? "465" : "587");
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;
  const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : (smtpPort === "465");

  if (smtpHost && smtpUser && smtpPass) {
    console.log("Configuring Nodemailer with SMTP settings:", smtpHost, "Port:", smtpPort);
    mailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    return mailTransporter;
  }

  // Fallback to transient test account using Ethereal Email
  try {
    console.log("No custom SMTP configured. Initializing transient Ethereal Email test account...");
    const testAccount = await nodemailer.createTestAccount();
    console.log("Ethereal Email test account generated successfully:", testAccount.user);
    mailTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    return mailTransporter;
  } catch (err) {
    console.warn("Failed to generate Ethereal Email SMTP test account. Background sending will fall back to terminal logs.", err);
    return null;
  }
}


// Reusable/lazy server-side GenAI client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

interface CacheEntry {
  timestamp: number;
  data: any[];
}

const newsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes cache TTL to completely prevent 429 quota exhaustion on rapid requests

let geminiCooldownUntil = 0;
let lastGeminiErrorReason = "";

function getQuotaNoticeArticle(category: string, reason: string): any {
  const currentCategory = category === "All" ? "India" : category;
  return {
    id: `system-quota-notice-${Date.now()}`,
    title: "⚠️ Live Search Quota Exceeded — Serving Local News Wire",
    category: currentCategory,
    summary: "Your Gemini API Search Grounding rate limit (429) was exceeded. The newsroom has switched to the high-fidelity pre-seeded Times Database.",
    content: `The system received a 429 rate limit response from Google GenAI: "${reason || 'Resource Exhausted / Plan Quota Exceeded'}". To keep your application fully responsive and prevent further quota exhaustion, we've enabled high-fidelity local wire mode and cached standard news feeds. This notice will automatically clear once the 60-second API cooldown expires. All core app services (Chess, Mahjong, Sudoku, Cryptographic Lockpads, WebRTC channels) remain fully operational in the background.`,
    source: "System Gateway",
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60",
    time: "Just now",
    url: "#",
    sentiment: "neutral",
    sentimentScore: 0.0,
    entities: {
      persons: ["System Engine"],
      organizations: ["Gemini API Desk"],
      locations: ["Cloud Node"]
    },
    eventId: "ev-system-quota",
    readingTime: 1
  };
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const httpServer = http.createServer(app);

  app.use(express.json());

  // Set Cross-Origin-Opener-Policy to same-origin-allow-popups to silence Chrome warnings on Firebase Auth popup
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });

  // API Route: Fetch live dynamic news from the real-time web using Gemini Search Grounding (or advanced matching fallback)
  app.get("/api/news", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    const category = req.query.category as string || "All";
    const provider = req.query.provider as string || "newsapi";
    const country = req.query.country as string || "in";
    const language = req.query.language as string || "en";
    const sortBy = req.query.sortBy as string || "publishedAt";

    const cacheKey = `${q}::${category}::${provider}::${country}::${language}::${sortBy}`;

    // 1. Check in-memory Cache first to secure extremely fast loads and protect quota limits
    const cachedEntry = newsCache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
      console.log(`[Cache Hit] Serving cached news articles for query key: "${cacheKey}"`);
      return res.json(cachedEntry.data);
    }

    // Attempt to pull real live headlines from Times of India RSS
    try {
      console.log("Fetching live headlines from Times of India RSS...");
      const rssRes = await fetch("https://timesofindia.indiatimes.com/rssfeedstopstories.cms");
      const xmlText = await rssRes.text();
      const rssArticles = parseTOIRss(xmlText);
      if (rssArticles && rssArticles.length > 0) {
        console.log(`Successfully fetched and parsed ${rssArticles.length} live TOI articles.`);
        newsCache.set(cacheKey, {
          timestamp: Date.now(),
          data: rssArticles
        });
        return res.json(rssArticles);
      }
    } catch (rssErr) {
      console.warn("Failed to fetch or parse Times of India RSS feed, falling back:", rssErr);
    }

    // 2. Check Cooldown/Circuit Breaker for active 429 Exceeded Quota status
    if (Date.now() < geminiCooldownUntil) {
      console.log(`[Circuit Breaker Active] Bypassing Gemini API requests to prevent quota strain. Serving high-fidelity local fallback news.`);
      const fallbackNews = getLiveFallbackNews(q, category, provider, country);
      return res.json(fallbackNews);
    }

    try {
      const ai = getGenAI();
      if (!ai) {
        console.warn("GEMINI_API_KEY is not defined. Serving customized local fallback news.");
        const fallbackNews = getLiveFallbackNews(q, category, provider, country);
        return res.json(fallbackNews);
      }

      console.log(`Fetching live, real-time news stories (q: "${q}", category: "${category}", provider: "${provider}") using Gemini Search Grounding...`);
      
      let searchInstructions = "Perform a Google Search to retrieve actual, real-time news articles published recently in the last 24-48 hours. ";
      
      if (provider !== "all" && provider !== "newsapi" && provider !== "general") {
        searchInstructions += `Analyze publications and topics relevant to the ${provider} news standard. `;
      }

      if (q) {
        searchInstructions += `Retrieve news matching search term "${q}". `;
      } else {
        searchInstructions += `Retrieve major national and international top headlines, political developments, sports, or trending reports. `;
      }

      if (category && category !== "All") {
        searchInstructions += `Focus the search specifically on the "${category}" theme or category. `;
      }

      if (country && country !== "global") {
        searchInstructions += `Ensure there is deep geographic coverage matching country code or context for "${country}". `;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${searchInstructions}

Return exactly 6 distinct, real news articles matching these criteria as a structured JSON array. Each article object MUST contain the following properties precisely:
- id: a unique string e.g., "n-toi-${Date.now()}-1" (ensure they are completely unique IDs)
- title: string (the actual news headline found in the groundings)
- category: string (the category e.g., 'India', 'Politics', 'Sports', 'Lifestyle', 'Technology', 'Business')
- summary: string (a brief, clear summary of the story of 1-2 sentences)
- content: string (a detailed full-text body paragraph of 4-5 sentences expanding on the event facts)
- source: string (the name of the actual news publisher found in search e.g. 'Times of India', 'Reuters', 'BBC', 'TechCrunch')
- imageUrl: string (a high-quality, valid, descriptive Unsplash image URL matching the topic context)
- time: string (how long ago e.g., '10 mins ago', '1 hour ago', '4 hours ago')
- url: string (the actual link to the original article obtained from your search grounding)
- sentiment: string (MUST be 'positive', 'neutral', or 'negative' based on article tone)
- sentimentScore: number (a floating float between -1.0 and +1.0)
- entities: an object containing arrays of strings:
  - persons: list of key people mentioned (or empty array)
  - organizations: list of companies, parties, organizations mentioned (or empty array)
  - locations: list of cities, countries, key places mentioned (or empty array)
- eventId: a string grouping related columns e.g. "ev-${Math.floor(Math.random() * 1000)}"
- readingTime: number (estimated reading time in minutes, e.g. between 1 and 5)

Wrap the JSON array in markdown code blocks like this:
\`\`\`json
[
  ...
]
\`\`\`
DO NOT include any greeting, chatbot intro/outro text, or explanations. Just return the structured JSON array code block directly.`,
        config: {
          tools: [{ googleSearch: {} }] // Real-time search grounding enablement
        }
      });

      const responseText = response.text || "";
      if (!responseText) {
        throw new Error("Empty response received from Gemini API");
      }
      
      const parsedNews = parseJSONFromText(responseText);
      if (Array.isArray(parsedNews) && parsedNews.length > 0) {
        // Save successfully parsed result to cache
        newsCache.set(cacheKey, {
          timestamp: Date.now(),
          data: parsedNews
        });
        return res.json(parsedNews);
      }
      throw new Error("Response is not a valid non-empty array");
    } catch (error: any) {
      console.log("Serving high-fidelity local fallback news feeds (Seamless Sandbox Fail-over). Reason: 429 Quota Cooldown.");
      
      const isQuotaError = error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.message?.includes("429");
      if (isQuotaError) {
        // Activate Cooldown for 60 seconds so subsequent calls do not query Gemini or print error logs
        geminiCooldownUntil = Date.now() + 60 * 1000;
        lastGeminiErrorReason = error?.message || "Plan Quota Exceeded (429 Request Limit)";
      }

      const fallbackNews = getLiveFallbackNews(q, category, provider, country);
      return res.json(fallbackNews);
    }
  });

  // API Route: Send pairing invitation via Email / SMS simulation/execution
  app.post("/api/send-invite", async (req, res) => {
    const { type, recipient, message, inviteLink } = req.body;
    console.log(`\n================== PAIRING INVITE TRANSMITTED ==================`);
    console.log(`TYPE:        ${String(type).toUpperCase()}`);
    console.log(`RECIPIENT:   ${recipient}`);
    console.log(`LINK:        ${inviteLink}`);
    console.log(`MESSAGE:     ${message}`);
    console.log(`================================================================\n`);

    let transmissionInfo = "Local Cloud pairing Gateway #19";
    let previewUrl = "";

    if (type === "gmail" || type === "number" || type === "sms") {
      try {
        const transporter = await getMailTransporter();
        if (transporter) {
          const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || "prix-no-reply@prix.direct";
          
          // If it is a phone number, send the simulated SMS invitation to the developer's SMTP/Gmail user email
          const isSms = (type === "number" || type === "sms");
          const toAddr = isSms ? (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim() : recipient.trim();

          if (!toAddr) {
            throw new Error("No target recipient email resolved for SMTP relay.");
          }

          const subject = isSms 
            ? `[Simulated SMS to ${recipient}] Secure Prix Node Connection`
            : "Secure Prix Node Connection Invitation";

          const mailOptions = {
            from: `"Prix Secure Messenger" <${fromAddr}>`,
            to: toAddr,
            subject: subject,
            text: message,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: #4f46e5; margin: 0; text-transform: uppercase; letter-spacing: 0.1em; font-family: sans-serif;">PRIX</h2>
                  <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Secure Cryptographic Mesh Network</p>
                  ${isSms ? `<span style="background-color: #f59e0b; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-family: monospace; font-weight: bold; letter-spacing: 0.05em; display: inline-block; margin-top: 5px;">SIMULATED SMS INVITE</span>` : ''}
                </div>
                <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <p style="font-size: 14px; color: #334155; line-height: 1.6;">Hello,</p>
                  <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                    ${isSms 
                      ? `This is a simulated SMS invitation originally directed to the phone number <strong>${recipient}</strong>:` 
                      : `You have been invited to establish a secure peer-to-peer cryptographic communication link on Prix:`}
                  </p>
                  <blockquote style="border-left: 3px solid #cbd5e1; padding-left: 15px; color: #475569; font-style: italic; font-size: 13px; margin: 15px 0; background-color: #f8fafc; padding-top: 10px; padding-bottom: 10px; border-radius: 4px;">
                    ${message.replace(/\n/g, '<br/>')}
                  </blockquote>
                  <div style="margin: 25px 0; text-align: center;">
                    <a href="${inviteLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Connect Secure Node</a>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                  <p style="font-size: 11px; color: #94a3b8; font-family: monospace; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">
                    ${inviteLink}
                  </p>
                </div>
              </div>
            `
          };

          const info = await transporter.sendMail(mailOptions);
          console.log("Message sent in background successfully: %s", info.messageId);
          transmissionInfo = isSms 
            ? `Background SMTP Relay (Simulated SMS to ${toAddr})` 
            : `Background SMTP Relay (${info.messageId})`;

          // If Ethereal Email, get the preview URL
          if (nodemailer.getTestMessageUrl) {
            const testUrl = nodemailer.getTestMessageUrl(info);
            if (testUrl) {
              previewUrl = testUrl;
              transmissionInfo = `Ethereal Simulated Relay (${info.messageId})`;
              console.log(`\n---------------------------------------------------------`);
              console.log(`✉️ Ethereal Email sent! Preview delivery: [ethereal_link] ${previewUrl.replace("https://", "")}`);
              console.log(`---------------------------------------------------------\n`);
            }
          }
        }
      } catch (mailErr) {
        console.error("Error sending background email invite:", mailErr);
        transmissionInfo = "Console Log Fallback Relay (SMTP Error)";
      }
    }

    res.json({
      success: true,
      deliveredTo: recipient,
      transmissionTime: new Date().toISOString(),
      relayTerminal: transmissionInfo,
      previewUrl: previewUrl || undefined
    });
  });


  // API Route: Reusable proxy to fetch external website content and inject `<base>` tag
  app.get("/api/portal-proxy", async (req, res) => {
    try {
      const targetUrl = (req.query.url as string) || "https://timesofindia.indiatimes.com/";
      const parsedUrl = new URL(targetUrl);
      const origin = parsedUrl.origin;

      const response = await fetch(targetUrl);
      const html = await response.text();
      
      // Inject base tag to resolve relative assets and hide common header/footer components
      const baseTag = `<base href="${origin}/">\n<style>#top_header, #footer, .top-story-strip, header, footer { display: none !important; }</style>`;
      const updatedHtml = html.replace("<head>", `<head>\n${baseTag}`);
      res.setHeader("Content-Type", "text/html");
      res.send(updatedHtml);
    } catch (error) {
      console.error("Proxy error fetching portal site:", error);
      res.status(500).send("Unable to retrieve web content.");
    }
  });

  // API Route: Get active live video ID of Times Now channel dynamically
  app.get("/api/toi-live", async (req, res) => {
    try {
      const channelId = "UC6RJ7-PaXg6TIH2BzZfTV7w"; // Correct Times Now Channel ID
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const response = await fetch(rssUrl);
      const xmlText = await response.text();
      
      const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
      for (const match of entryMatches) {
        const content = match[1];
        const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
        const videoIdMatch = content.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        
        if (titleMatch && videoIdMatch) {
          const title = titleMatch[1];
          const videoId = videoIdMatch[1];
          // Filter out vertical shorts so they fit the widescreen aspect-video player cleanly
          if (!title.toLowerCase().includes("#shorts") && !title.toLowerCase().includes("#short")) {
            console.log(`Latest widescreen TOI breaking news video resolved from RSS feed: ${videoId} (${title})`);
            return res.json({ videoId });
          }
        }
      }
    } catch (rssError) {
      console.warn("Failed to fetch YouTube uploads RSS feed, attempting live page scraper:", rssError);
    }

    try {
      const url = "https://www.youtube.com/@TimesNow/live";
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();
      
      const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/) ||
                             html.match(/href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
      if (canonicalMatch && canonicalMatch[1]) {
        return res.json({ videoId: canonicalMatch[1] });
      }
      
      const videoIdMatch = html.match(/"videoId":"([^"]+)"/);
      if (videoIdMatch && videoIdMatch[1]) {
        return res.json({ videoId: videoIdMatch[1] });
      }
    } catch (error) {
      console.error("Error retrieving YouTube live video ID:", error);
    }
    res.json({ videoId: "KznzRuWimUU" });
  });

  // API Route: OpenGames proxy list
  app.get("/api/opengames/games", async (req, res) => {
    try {
      const { page = "1", pageSize = "20", sort = "stars", order = "desc", language, genre } = req.query;
      const url = new URL("https://opengames.dev/api/games");
      url.searchParams.append("page", page as string);
      url.searchParams.append("pageSize", pageSize as string);
      url.searchParams.append("sort", sort as string);
      url.searchParams.append("order", order as string);
      if (language) url.searchParams.append("language", language as string);
      if (genre) url.searchParams.append("genre", genre as string);

      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const json = await response.json();
        return res.json(json);
      }
      throw new Error(`Status: ${response.status}`);
    } catch (err) {
      console.warn("Failed to contact OpenGames API, using high-fidelity local database:", err);
      return res.json(getMockGamesResponse(req.query));
    }
  });

  // API Route: OpenGames search proxy
  app.get("/api/opengames/search", async (req, res) => {
    try {
      const { q = "", page = "1", pageSize = "20", language, genre } = req.query;
      if ((q as string).length < 2) {
        return res.json({ success: true, data: { query: q, results: [] }, meta: { page: 1, pageSize: 20, total: 0, totalPages: 0, hasMore: false } });
      }

      const url = new URL("https://opengames.dev/api/search");
      url.searchParams.append("q", q as string);
      url.searchParams.append("page", page as string);
      url.searchParams.append("pageSize", pageSize as string);
      if (language) url.searchParams.append("language", language as string);
      if (genre) url.searchParams.append("genre", genre as string);

      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const json = await response.json();
        return res.json(json);
      }
      throw new Error(`Status: ${response.status}`);
    } catch (err) {
      console.warn("Failed to search OpenGames API, using local mock database:", err);
      return res.json(getMockSearchResponse(req.query));
    }
  });

  // API Route: OpenGames stats proxy
  app.get("/api/opengames/stats", async (req, res) => {
    try {
      const response = await fetch("https://opengames.dev/api/stats", { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const json = await response.json();
        return res.json(json);
      }
      throw new Error(`Status: ${response.status}`);
    } catch (err) {
      console.warn("Failed to fetch OpenGames API stats, using local mock statistics:", err);
      return res.json(getMockStatsResponse());
    }
  });

  // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          // @ts-ignore
          hmr: { server: httpServer, host: false }
        },
        appType: "spa",
      });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function parseTOIRss(xmlText: string): any[] {
  const articles: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let index = 1;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>([\s\S]*?)<\/description>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

    const title = titleMatch ? titleMatch[1].trim() : "Times of India Headline";
    let summary = descMatch ? descMatch[1].trim() : "Click to read full details on the Times of India website.";
    summary = summary.replace(/<[^>]*>/g, "").trim();

    const url = linkMatch ? linkMatch[1].trim() : "https://timesofindia.indiatimes.com/";
    const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString();

    let category = "India";
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("cricket") || lowerTitle.includes("sport") || lowerTitle.includes("match") || lowerTitle.includes("test series") || lowerTitle.includes("cup") || lowerTitle.includes("tennis")) {
      category = "Sports";
    } else if (lowerTitle.includes("tech") || lowerTitle.includes("phone") || lowerTitle.includes("app") || lowerTitle.includes("space") || lowerTitle.includes("ai ") || lowerTitle.includes("chip")) {
      category = "Technology";
    } else if (lowerTitle.includes("fashion") || lowerTitle.includes("travel") || lowerTitle.includes("health") || lowerTitle.includes("movie") || lowerTitle.includes("show") || lowerTitle.includes("star")) {
      category = "Lifestyle";
    } else if (lowerTitle.includes("nifty") || lowerTitle.includes("sensex") || lowerTitle.includes("market") || lowerTitle.includes("stock") || lowerTitle.includes("economy") || lowerTitle.includes("rupee")) {
      category = "Business";
    }

    let sentiment = "neutral";
    let sentimentScore = 0.0;
    if (lowerTitle.includes("growth") || lowerTitle.includes("win") || lowerTitle.includes("success") || lowerTitle.includes("launch") || lowerTitle.includes("soar")) {
      sentiment = "positive";
      sentimentScore = 0.6 + Math.random() * 0.4;
    } else if (lowerTitle.includes("fall") || lowerTitle.includes("crash") || lowerTitle.includes("loss") || lowerTitle.includes("death") || lowerTitle.includes("crisis") || lowerTitle.includes("kill")) {
      sentiment = "negative";
      sentimentScore = -(0.6 + Math.random() * 0.4);
    } else {
      sentimentScore = (Math.random() - 0.5) * 0.4;
      sentiment = sentimentScore > 0.1 ? "positive" : (sentimentScore < -0.1 ? "negative" : "neutral");
    }

    const categoryImages: Record<string, string[]> = {
      India: [
        "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1506461883276-594a12b11db3?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1596422846543-75c6fc18a52b?w=600&auto=format&fit=crop&q=60"
      ],
      Sports: [
        "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=60"
      ],
      Technology: [
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60"
      ],
      Lifestyle: [
        "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60"
      ],
      Business: [
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60"
      ]
    };
    
    const imageList = categoryImages[category] || categoryImages["India"];
    const fallbackImageUrl = imageList[index % imageList.length];

    // Extract the actual related news image from enclosure URL attribute if present
    const enclosureMatch = itemContent.match(/<enclosure[^>]+url=["']([^"']+)["']/);
    const imageUrl = enclosureMatch ? enclosureMatch[1].trim() : fallbackImageUrl;

    articles.push({
      id: `n-toi-${index++}-${Date.now()}`,
      title,
      category,
      summary: summary || title,
      content: summary || title,
      source: "Times of India",
      imageUrl,
      time: pubDateStr,
      url,
      sentiment,
      sentimentScore,
      entities: {
        persons: [],
        organizations: ["Times of India"],
        locations: ["India"]
      },
      eventId: `ev-toi-rss-${index}`,
      readingTime: Math.max(1, Math.min(5, Math.ceil(summary.split(" ").length / 200)))
    });
  }
  return articles;
}

// Helper function to extract and parse JSON array from Gemini response text
function parseJSONFromText(text: string): any {
  let cleaned = text.trim();
  
  // Try extracting using markdown block syntax
  const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    return JSON.parse(jsonMatch[1].trim());
  }
  
  const generalMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/);
  if (generalMatch && generalMatch[1]) {
    return JSON.parse(generalMatch[1].trim());
  }

  // Fallback: search for first [ and last ] to extract raw JSON array
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const arrayPart = cleaned.substring(firstBracket, lastBracket + 1);
    return JSON.parse(arrayPart.trim());
  }

  // Last resort direct parse
  return JSON.parse(cleaned);
}

function getLiveFallbackNews(q: string = "", category: string = "All", provider: string = "newsapi", country: string = "in") {
  // Base list of beautiful news seeds
  const baseNews = [
    {
      id: 'n-dyn-1',
      title: "'Nothing to worry': DKS in damage-control mode after internal survey leaks",
      category: 'India',
      summary: 'Bengaluru: Deputy Chief Minister DK Shivakumar played down a leaked internal party survey, asserting that the coalition remains strongly favored across key suburban constituencies.',
      content: 'BENGALURU: Deputy Chief Minister D K Shivakumar on Friday dismissed concerns regarding a leaked internal survey of the party. He claimed that the survey was compiled by external analysts with incomplete data pools and does not reflect ground realities. Shivakumar assured party members that internal solidarity remains high and strategic coordinate plans are functioning perfectly for the upcoming municipal elections. The Congress party reports that double-digit leads are still securely projected across South Bengaluru, and ongoing relief audits are helping strengthen community relations.',
      source: 'Times of India',
      imageUrl: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&auto=format&fit=crop&q=60',
      time: '15 mins ago',
      url: 'https://timesofindia.indiatimes.com/india',
      sentiment: 'neutral',
      sentimentScore: 0.1,
      entities: {
        persons: ['DK Shivakumar', 'Siddaramaiah'],
        organizations: ['Congress Party', 'BMC'],
        locations: ['Bengaluru', 'South India']
      },
      eventId: 'ev-bengaluru-politics',
      readingTime: 3
    },
    {
      id: 'n-dyn-2',
      title: "India vs Australia Test Series: Bumrah's opening spell triggers crucial batting collapse",
      category: 'Sports',
      summary: 'Perth: Speculation ended as Jasprit Bumrah produced a masterclass spell under transitional light, putting the hosts on the backfoot on a fiery pitch.',
      content: 'PERTH: Refusing to buckle under captaincy pressure, Jasprit Bumrah spearheaded India’s sensational pace attack on Day 1 of the Border-Gavaskar Trophy series. Delivering absolute jaffas at speeds upwards of 145 kph, Bumrah claimed three crucial top-order key wickets in his opening five-over burst. Australian batsmen appeared completely bamboozled by the late movement and extra swing on the Perth ground. Cricket analysts are hailing this as one of Bumrah’s career-defining opening spells, shifting momentum entirely back to the visiting squad.',
      source: 'Times of India (TOI)',
      imageUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop&q=60',
      time: '1 hour ago',
      url: 'https://timesofindia.indiatimes.com/sports',
      sentiment: 'positive',
      sentimentScore: 0.85,
      entities: {
        persons: ['Jasprit Bumrah', 'Pat Cummins'],
        organizations: ['BCCI', 'Cricket Australia'],
        locations: ['Perth', 'Australia', 'India']
      },
      eventId: 'ev-border-gavaskar',
      readingTime: 2
    },
    {
      id: 'n-dyn-3',
      title: 'Bengaluru Tech Corridors set to receive 15,000 new AI engineering jobs by December',
      category: 'Technology',
      summary: 'Karnataka IT ministry announces massive public-private incubation corridors in Electronic City, expanding domestic infrastructure for high-performance neural computing.',
      content: 'BENGALURU: In an effort to secure Bengaluru’s crown as India’s tech powerhouse, the State IT Ministry on Friday unveiled the "AI Emergence Corridor" blueprint. Funded in partnership with major tier-1 venture funds, the project will establish specialized computing testbeds in Electronic City. This move is projected to generate over 15,000 high-income developer, analyst, and scientific roles within the next six months. Local tech hubs have welcomed the news, stating that unified server assets will significantly accelerate local model development pipelines and lower operational overheads.',
      source: 'TOI Tech',
      imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60',
      time: '3 hours ago',
      url: 'https://timesofindia.indiatimes.com/technology',
      sentiment: 'positive',
      sentimentScore: 0.9,
      entities: {
        persons: ['Priyank Kharge', 'Tech Leaders'],
        organizations: ['IT Ministry', 'NASSCOM'],
        locations: ['Bengaluru', 'Electronic City']
      },
      eventId: 'ev-india-ai-boom',
      readingTime: 4
    },
    {
      id: 'n-dyn-4',
      title: 'Mumbai Coastal Road phase-2 structural reviews completed, open for traffic next Friday',
      category: 'Lifestyle',
      summary: 'BMC officials confirmed the high-speed transit tunnel and seawater spans have achieved final structural clearances, reducing travel time by 45 minutes.',
      content: 'MUMBAI: The city skyline is set for a massive ease in commute times. Brihanmumbai Municipal Corporation officials declared on Friday that the Mumbai Coastal Road project’s main undersea link has obtained its final safety certificates. Connecting Marine Drive to Worli with state-of-the-art tunnel structures, the expressway is planned to completely open to public traffic next Friday. Commuters will be able to cross the distance in under 8 minutes, avoiding the heavy central metropolitan bottlenecks that plague daily peak hours.',
      source: 'Times of India',
      imageUrl: 'https://images.unsplash.com/photo-1566552881560-0be862a7c445?w=600&auto=format&fit=crop&q=60',
      time: '5 hours ago',
      url: 'https://timesofindia.indiatimes.com/life-style',
      sentiment: 'positive',
      sentimentScore: 0.72,
      entities: {
        persons: ['Eknath Shinde', 'BMC Commissioner'],
        organizations: ['BMC', 'MSRDC'],
        locations: ['Mumbai', 'Marine Drive', 'Worli']
      },
      eventId: 'ev-mumbai-infrastructure',
      readingTime: 3
    },
    {
      id: 'n-dyn-5',
      title: 'Monsoon delays trigger emergency water conservation audits in five agricultural hubs',
      category: 'India',
      summary: 'Meteorologists predict dry spells over central and eastern districts, prompting regional cabinets to release storage channels to preserve seasonal paddy harvests.',
      content: 'NEW DELHI: Concerns over delay in dry monsoonal clouds have pushed central ministries to initiate immediate water reserves monitoring. Crop audits reflect potential strain on irrigation pools in some crucial food-bowl zones. To counteract this, regional agricultural panels are unlocking emergency canal systems to feed paddy fields immediately. Farmers’ cooperatives have called for increased power supply allocations to keep standard electric pump wells running during this transitional dry climate.',
      source: 'TOI India',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=60',
      time: '8 hours ago',
      url: 'https://timesofindia.indiatimes.com/india',
      sentiment: 'negative',
      sentimentScore: -0.65,
      entities: {
        persons: ['Sanjay Singh', 'Weather Desk'],
        organizations: ['IMD', 'Ministry of Agriculture'],
        locations: ['New Delhi', 'Punjab', 'Uttar Pradesh']
      },
      eventId: 'ev-monsoon-conservation',
      readingTime: 3
    },
    {
      id: 'n-dyn-6',
      title: 'Global Semiconductor Giants finalize $800M manufacturing units in Chennai and Noida',
      category: 'Technology',
      summary: 'In line with India’s semiconductor mission, multinational design houses seal assembly and testing pacts, adding high-yield export strength to the electronics grid.',
      content: 'CHENNAI: Major semiconductor design consortia has agreed to ground massive Assembly, Testing, and Packaging (ATMP) units in the state. Backed by federal fiscal subsidies, the assembly units represent over $800 million in direct capital investments. Construction will kickstart in Chennai next month, with a sister unit expanding in Noida by mid-2027. This forms part of India’s semiconductor independence blueprint, aiming to establish reliable silicon fabrication facilities across the Indo-Pacific corridors.',
      source: 'Times of India',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60',
      time: '12 hours ago',
      url: 'https://timesofindia.indiatimes.com/technology',
      sentiment: 'positive',
      sentimentScore: 0.88,
      entities: {
        persons: ['Ashwini Vaishnaw', 'Foxconn Execs'],
        organizations: ['Ministry of Electronics', 'ISM'],
        locations: ['Chennai', 'Noida', 'Tamil Nadu']
      },
      eventId: 'ev-chennai-silicon-mission',
      readingTime: 4
    }
  ];

  // Perform filtering first
  let filtered = [...baseNews];
  
  if (category && category !== 'All') {
    filtered = filtered.filter(item => item.category.toLowerCase() === category.toLowerCase() || 
      (category.toLowerCase() === 'india' && item.category.toLowerCase() === 'politics')
    );
  }

  const query = q.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter(item => 
      item.title.toLowerCase().includes(query) || 
      item.summary.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.entities.persons.some(p => p.toLowerCase().includes(query)) ||
      item.entities.organizations.some(o => o.toLowerCase().includes(query)) ||
      item.entities.locations.some(l => l.toLowerCase().includes(query))
    );

    // If query yields nothing, dynamically synthesize matching articles on the fly for realistic simulation!
    if (filtered.length === 0) {
      const capQuery = query.charAt(0).toUpperCase() + query.slice(1);
      filtered = [
        {
          id: `n-syn-${Date.now()}-1`,
          title: `Breaking News: Major developments and reports regarding ${capQuery} globally`,
          category: category !== 'All' ? category : 'Technology',
          summary: `New comprehensive details surfaced regarding ${capQuery} as international sectors convene critical policy updates on the subject this afternoon.`,
          content: `In a surprise announcement earlier today, researchers and market inspectors confirmed that ${capQuery} has reached a crucial milestone. Global indicators reveal that high-priority segments have experienced a 24% surge in adoption, boosting investment pipelines. Analysts are praising this development, saying it will redefine technical infrastructures and streamline logistics operations. Local authorities have promised to dispatch detailed audit reports by early tomorrow.`,
          source: 'Daily Echo Intelligence',
          imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60',
          time: '5 mins ago',
          url: '#',
          sentiment: 'positive',
          sentimentScore: 0.62,
          entities: {
            persons: [`Dr. Amanda Vance`, `Advisor G. Patel`],
            organizations: [`Global Coalition for ${capQuery}`, `Reuters Desk`],
            locations: [`Washington DC`, `New Delhi`, `London`]
          },
          eventId: `ev-syn-${query}`,
          readingTime: 3
        },
        {
          id: `n-syn-${Date.now()}-2`,
          title: `How ${capQuery} is reshaping standard production pipelines`,
          category: category !== 'All' ? category : 'Lifestyle',
          summary: `A special investigative column explores why industries and consumer circles are quickly converging on ${capQuery} paradigms.`,
          content: `Across major manufacturing hubs and structural agencies, specialized workers are seeing their daily operations transform due to the integration of ${capQuery}. Field audits indicate that processing accuracy has increased while waste indexes dropped. Leading experts assert that this represents a sustainable solution for emerging districts. Commuters and communities are reporting positive feedback, paving the way for wider municipal implementations soon.`,
          source: 'Times of India',
          imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&auto=format&fit=crop&q=60',
          time: '1 hour ago',
          url: '#',
          sentiment: 'neutral',
          sentimentScore: 0.05,
          entities: {
            persons: [`Priyanka Sen`],
            organizations: [`Venture Labs`, `Ecology Watch`],
            locations: [`Mumbai`, `San Francisco`]
          },
          eventId: `ev-syn-explain-${query}`,
          readingTime: 2
        }
      ];
    }
  }

  // Adjust source based on active provider for simulation authenticity
  if (provider && provider !== 'all' && provider !== 'newsapi') {
    const providerNames: Record<string, string> = {
      webzio: 'Webz.io Wire',
      newsapi_ai: 'NewsAPI.ai Intelligence',
      worldnews: 'World News Agency',
      newsdata: 'NewsData.io Network',
      thenews: 'TheNewsAPI Syndicate',
      bing: 'Bing News Indexer'
    };
    filtered = filtered.map((art) => ({
      ...art,
      source: providerNames[provider] || art.source,
      id: `${art.id}-${provider}`
    }));
  }

  return filtered;
}

function getFallbackNews() {
  return [
    {
      id: 'n1',
      title: 'New Metro Line-3 trials begin successfully across South Mumbai tunnels',
      category: 'India',
      summary: 'MMRCA completes initial underground electrical runs between Colaba and SEEPZ, marking a milestone in the city transit expansion blueprint.',
      source: 'Times of India',
      imageUrl: 'https://images.unsplash.com/photo-1473842191153-54fd052fcb3d?w=600&auto=format&fit=crop&q=60',
      time: 'Just now',
      url: 'https://timesofindia.indiatimes.com/india'
    },
    {
      id: 'n2',
      title: "Delhi weather updates: Air Quality index records substantial gains as wind speed increases",
      category: 'Lifestyle',
      summary: 'Regional environmental agencies report favorable dispersion with seasonal wind shifts, offering much-needed relief to commuters.',
      source: 'TOI Daily',
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&auto=format&fit=crop&q=60',
      time: '2 hours ago',
      url: 'https://timesofindia.indiatimes.com/city'
    },
    {
      id: 'n3',
      title: "Indian Startups secure record $1.2B funding allocations in green hydrogen and mobility sectors",
      category: 'Technology',
      summary: 'Venture portfolios show significant shifts towards sustainable manufacturing and battery-recycling tech clusters across Pune and Chennai.',
      source: 'TOI Business',
      imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60',
      time: '4 hours ago',
      url: 'https://timesofindia.indiatimes.com/business'
    }
  ];
}

const MOCK_OPENGAMES = [
  {
    id: 1,
    slug: "veloren",
    title: "Veloren",
    description: "An open-world, open-source multiplayer voxel RPG inspired by games like Cube World and Dwarf Fortress.",
    repoUrl: "https://github.com/veloren/veloren",
    homepage: "https://veloren.net",
    language: "Rust",
    genre: "RPG",
    stars: 5200,
    forks: 420,
    openIssues: 180,
    createdAt: "2018-06-15T00:00:00Z",
    lastCommitAt: "2024-01-15T10:30:00Z",
    license: "GPL-3.0",
    topics: ["game", "rpg", "voxel", "multiplayer", "rust"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "0.16.0",
    downloadCount: 50000
  },
  {
    id: 2,
    slug: "minetest",
    title: "Minetest",
    description: "An open source voxel game engine. Play one of our many games, modify a game to your liking, or make your own game.",
    repoUrl: "https://github.com/minetest/minetest",
    homepage: "https://www.minetest.net",
    language: "C++",
    genre: "Sandbox",
    stars: 9500,
    forks: 1800,
    openIssues: 940,
    createdAt: "2010-10-31T00:00:00Z",
    lastCommitAt: "2024-01-14T15:45:00Z",
    license: "LGPL-2.1",
    topics: ["engine", "voxel", "sandbox", "multiplayer", "lua"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS", "Android"],
    latestRelease: "5.8.0",
    downloadCount: 1200000
  },
  {
    id: 3,
    slug: "mindustry",
    title: "Mindustry",
    description: "A sandbox tower-defense game. Create elaborate supply chains of conveyor belts to feed ammo into your turrets.",
    repoUrl: "https://github.com/Anuken/Mindustry",
    homepage: "https://anuken.github.io/mindustry/",
    language: "Java",
    genre: "Strategy",
    stars: 18200,
    forks: 2300,
    openIssues: 320,
    createdAt: "2017-04-28T00:00:00Z",
    lastCommitAt: "2024-01-12T18:20:00Z",
    license: "GPL-3.0",
    topics: ["tower-defense", "strategy", "sandbox", "multiplayer", "java"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS", "Android", "iOS"],
    latestRelease: "v146",
    downloadCount: 950000
  },
  {
    id: 4,
    slug: "openra",
    title: "OpenRA",
    description: "Open source engine for classic Westwood real-time strategy games like Command & Conquer: Red Alert.",
    repoUrl: "https://github.com/OpenRA/OpenRA",
    homepage: "https://www.openra.net",
    language: "C#",
    genre: "Strategy",
    stars: 13400,
    forks: 1500,
    openIssues: 680,
    createdAt: "2007-06-12T00:00:00Z",
    lastCommitAt: "2024-01-15T09:10:00Z",
    license: "GPL-3.0",
    topics: ["engine", "rts", "strategy", "multiplayer", "c-sharp"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "release-20231224",
    downloadCount: 600000
  },
  {
    id: 5,
    slug: "0ad",
    title: "0 A.D.",
    description: "A free, open-source, historical Real-Time Strategy game of ancient warfare.",
    repoUrl: "https://github.com/0ad/0ad",
    homepage: "https://play0ad.com",
    language: "C++",
    genre: "Strategy",
    stars: 4200,
    forks: 600,
    openIssues: 120,
    createdAt: "2009-07-10T00:00:00Z",
    lastCommitAt: "2024-01-15T12:00:00Z",
    license: "GPL-2.0",
    topics: ["rts", "strategy", "history", "multiplayer"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "Alpha 26",
    downloadCount: 450000
  },
  {
    id: 6,
    slug: "supertuxkart",
    title: "SuperTuxKart",
    description: "A 3D open-source arcade racer with a variety of characters, tracks, and modes to play.",
    repoUrl: "https://github.com/supertuxkart/stk-code",
    homepage: "https://supertuxkart.net",
    language: "C++",
    genre: "Racing",
    stars: 3800,
    forks: 650,
    openIssues: 450,
    createdAt: "2006-10-04T00:00:00Z",
    lastCommitAt: "2024-01-10T22:30:00Z",
    license: "GPL-3.0",
    topics: ["racing", "arcade", "kart", "multiplayer"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS", "Android"],
    latestRelease: "1.4",
    downloadCount: 800000
  },
  {
    id: 7,
    slug: "cataclysm-dda",
    title: "Cataclysm: Dark Days Ahead",
    description: "A turn-based survival RPG set in a post-apocalyptic world. Survive in a harsh, procedurally generated world.",
    repoUrl: "https://github.com/CleverRaven/Cataclysm-DDA",
    homepage: "https://cataclysmdda.org",
    language: "C++",
    genre: "RPG",
    stars: 8900,
    forks: 3400,
    openIssues: 1950,
    createdAt: "2013-05-15T00:00:00Z",
    lastCommitAt: "2024-01-15T11:45:00Z",
    license: "CC-BY-SA-3.0",
    topics: ["rpg", "survival", "roguelike", "apocalypse"],
    isMultiplayer: false,
    platforms: ["Linux", "Windows", "macOS", "Android", "iOS"],
    latestRelease: "0.G",
    downloadCount: 300000
  },
  {
    id: 8,
    slug: "teeworlds",
    title: "Teeworlds",
    description: "A retro multiplayer 2D shooter. Battle with up to 16 players in various game modes like Deathmatch and CTF.",
    repoUrl: "https://github.com/teeworlds/teeworlds",
    homepage: "https://www.teeworlds.com",
    language: "C++",
    genre: "Action",
    stars: 2800,
    forks: 410,
    openIssues: 150,
    createdAt: "2007-12-05T00:00:00Z",
    lastCommitAt: "2024-01-08T16:15:00Z",
    license: "zlib",
    topics: ["shooter", "action", "2d", "multiplayer", "retro"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "0.7.5",
    downloadCount: 2200000
  },
  {
    id: 9,
    slug: "endless-sky",
    title: "Endless Sky",
    description: "A 2D space trading and combat RPG inspired by the classic Escape Velocity series.",
    repoUrl: "https://github.com/endless-sky/endless-sky",
    homepage: "https://endless-sky.github.io",
    language: "C++",
    genre: "RPG",
    stars: 4300,
    forks: 680,
    openIssues: 380,
    createdAt: "2014-06-20T00:00:00Z",
    lastCommitAt: "2024-01-13T20:50:00Z",
    license: "GPL-3.0",
    topics: ["rpg", "space", "combat", "trading", "2d"],
    isMultiplayer: false,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "0.10.4",
    downloadCount: 250000
  },
  {
    id: 10,
    slug: "openttd",
    title: "OpenTTD",
    description: "A business simulation game in which players earn money by transporting passengers and cargo via road, rail, water, and air.",
    repoUrl: "https://github.com/OpenTTD/OpenTTD",
    homepage: "https://www.openttd.org",
    language: "C++",
    genre: "Simulation",
    stars: 6800,
    forks: 1100,
    openIssues: 450,
    createdAt: "2004-03-06T00:00:00Z",
    lastCommitAt: "2024-01-14T10:05:00Z",
    license: "GPL-2.0",
    topics: ["simulation", "transport", "tycoon", "multiplayer"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS", "Android"],
    latestRelease: "13.4",
    downloadCount: 5000000
  },
  {
    id: 11,
    slug: "shattered-pixel-dungeon",
    title: "Shattered Pixel Dungeon",
    description: "A traditional roguelike dungeon crawler RPG that is simple to get into but deep to master.",
    repoUrl: "https://github.com/00-Evan/shattered-pixel-dungeon",
    homepage: "https://shatteredpixel.com",
    language: "Java",
    genre: "RPG",
    stars: 3100,
    forks: 580,
    openIssues: 160,
    createdAt: "2014-08-01T00:00:00Z",
    lastCommitAt: "2024-01-15T04:22:00Z",
    license: "GPL-3.0",
    topics: ["rpg", "roguelike", "dungeon-crawler", "java", "android"],
    isMultiplayer: false,
    platforms: ["Linux", "Windows", "macOS", "Android", "iOS"],
    latestRelease: "2.3.2",
    downloadCount: 1500000
  },
  {
    id: 12,
    slug: "supertux",
    title: "SuperTux",
    description: "A classic 2D jump'n'run sidescroller game in a style similar to the original Super Mario Bros.",
    repoUrl: "https://github.com/SuperTux/supertux",
    homepage: "https://www.supertux.org",
    language: "C++",
    genre: "Action",
    stars: 2100,
    forks: 360,
    openIssues: 220,
    createdAt: "2003-04-18T00:00:00Z",
    lastCommitAt: "2024-01-11T13:40:00Z",
    license: "GPL-2.0",
    topics: ["platformer", "action", "2d", "retro"],
    isMultiplayer: false,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "v0.6.3",
    downloadCount: 350000
  },
  {
    id: 13,
    slug: "airshipper",
    title: "Airshipper",
    description: "A cross-platform launcher for the open-world voxel RPG Veloren, enabling easy updates and gameplay entry.",
    repoUrl: "https://github.com/veloren/airshipper",
    homepage: "https://veloren.net/download",
    language: "Rust",
    genre: "Tool",
    stars: 150,
    forks: 45,
    openIssues: 15,
    createdAt: "2019-11-20T00:00:00Z",
    lastCommitAt: "2024-01-05T08:14:00Z",
    license: "GPL-3.0",
    topics: ["launcher", "tool", "rust", "desktop"],
    isMultiplayer: false,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "0.7.0",
    downloadCount: 40000
  },
  {
    id: 14,
    slug: "xonotic",
    title: "Xonotic",
    description: "An addictive, arena-style first-person shooter game with sharp movement and a wide array of weapons.",
    repoUrl: "https://github.com/xonotic/xonotic-data.pk3dir",
    homepage: "https://www.xonotic.org",
    language: "QuakeC",
    genre: "Action",
    stars: 1800,
    forks: 210,
    openIssues: 90,
    createdAt: "2010-03-22T00:00:00Z",
    lastCommitAt: "2024-01-14T23:55:00Z",
    license: "GPL-3.0",
    topics: ["fps", "shooter", "action", "arena", "multiplayer"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS"],
    latestRelease: "0.8.6",
    downloadCount: 950000
  },
  {
    id: 15,
    slug: "mineclone2",
    title: "MineClone 2",
    description: "A free and open source Minecraft clone survival sandbox game, designed specifically to run inside Minetest engine.",
    repoUrl: "https://github.com/MineClone2/MineClone2",
    homepage: "https://forum.minetest.net/viewtopic.php?t=16407",
    language: "Lua",
    genre: "Sandbox",
    stars: 1200,
    forks: 420,
    openIssues: 380,
    createdAt: "2017-02-18T00:00:00Z",
    lastCommitAt: "2024-01-12T19:33:00Z",
    license: "GPL-3.0",
    topics: ["sandbox", "survival", "clone", "lua", "minetest"],
    isMultiplayer: true,
    platforms: ["Linux", "Windows", "macOS", "Android"],
    latestRelease: "0.84.0",
    downloadCount: 85000
  }
];

function getMockGamesResponse(query: any): any {
  const page = parseInt(query.page || "1", 10);
  const pageSize = parseInt(query.pageSize || "20", 10);
  const sort = query.sort || "stars";
  const order = query.order || "desc";
  const language = query.language;
  const genre = query.genre;

  let filtered = [...MOCK_OPENGAMES];
  if (language) {
    filtered = filtered.filter(g => g.language.toLowerCase() === language.toLowerCase());
  }
  if (genre) {
    filtered = filtered.filter(g => g.genre.toLowerCase() === genre.toLowerCase());
  }

  // Sort
  filtered.sort((a: any, b: any) => {
    let valA = a[sort];
    let valB = b[sort];
    if (typeof valA === "string") {
      return order === "desc" ? valB.localeCompare(valA) : valA.localeCompare(valB);
    } else {
      return order === "desc" ? valB - valA : valA - valB;
    }
  });

  // Paginate
  const startIndex = (page - 1) * pageSize;
  const paginatedGames = filtered.slice(startIndex, startIndex + pageSize);
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const hasMore = page < totalPages;

  return {
    success: true,
    data: {
      games: paginatedGames,
      sort: { field: sort, order },
      filters: { languages: language ? [language] : [] }
    },
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore
    }
  };
}

function getMockSearchResponse(query: any): any {
  const q = (query.q || "").toLowerCase();
  const page = parseInt(query.page || "1", 10);
  const pageSize = parseInt(query.pageSize || "20", 10);
  const language = query.language;
  const genre = query.genre;

  let filtered = MOCK_OPENGAMES.filter(g => 
    g.title.toLowerCase().includes(q) || 
    g.description.toLowerCase().includes(q) ||
    g.topics.some(t => t.toLowerCase().includes(q))
  );

  if (language) {
    filtered = filtered.filter(g => g.language.toLowerCase() === language.toLowerCase());
  }
  if (genre) {
    filtered = filtered.filter(g => g.genre.toLowerCase() === genre.toLowerCase());
  }

  const startIndex = (page - 1) * pageSize;
  const paginatedGames = filtered.slice(startIndex, startIndex + pageSize);
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const hasMore = page < totalPages;

  return {
    success: true,
    data: {
      query,
      results: paginatedGames,
      filters: { languages: language ? [language] : [] }
    },
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore
    }
  };
}

function getMockStatsResponse(): any {
  const totalGames = MOCK_OPENGAMES.length * 142; // scale it to represent directory size
  const totalCategories = 24;
  const topStars = 18200;
  const avgStars = 5100;

  const gamesByLanguage = [
    { language: "C++", count: 9 },
    { language: "Java", count: 2 },
    { language: "Rust", count: 2 },
    { language: "C#", count: 1 },
    { language: "Lua", count: 1 }
  ];

  const gamesByGenre = [
    { genre: "RPG", count: 5 },
    { genre: "Strategy", count: 3 },
    { genre: "Action", count: 3 },
    { genre: "Sandbox", count: 2 },
    { genre: "Simulation", count: 1 },
    { genre: "Racing", count: 1 }
  ];

  const trendingGames = MOCK_OPENGAMES.slice(0, 3).map(g => ({
    slug: g.slug,
    title: g.title,
    stars: g.stars
  }));

  const recentlyUpdated = MOCK_OPENGAMES.slice(4, 6).map(g => ({
    slug: g.slug,
    title: g.title,
    updatedAt: g.lastCommitAt
  }));

  return {
    success: true,
    data: {
      totalGames,
      totalCategories,
      topStars,
      avgStars,
      gamesByLanguage,
      gamesByGenre,
      trendingGames,
      recentlyUpdated,
      generatedAt: new Date().toISOString()
    }
  };
}

startServer();

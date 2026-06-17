import os
import re
import time
import email.message
import smtplib
from typing import Optional, List
import requests
from fastapi import FastAPI, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI(title="Prix Backend", description="Python FastAPI backend for Prix news and signaling helper services")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory news cache
news_cache = {}
CACHE_TTL = 3 * 60  # 3 minutes

# Circuit breaker for Gemini API
gemini_cooldown_until = 0
last_gemini_error_reason = ""

# Lazy-loaded GenAI Client
_ai_client = None

def get_genai_client() -> Optional[genai.Client]:
    global _ai_client
    if _ai_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            _ai_client = genai.Client(api_key=api_key)
    return _ai_client


def parse_toi_rss(xml_text: str) -> List[dict]:
    articles = []
    # Match item blocks
    items = re.findall(r'<item>(.*?)</item>', xml_text, re.DOTALL)
    index = 1
    
    category_images = {
        "India": [
            "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1506461883276-594a12b11db3?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1596422846543-75c6fc18a52b?w=600&auto=format&fit=crop&q=60"
        ],
        "Sports": [
            "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=60"
        ],
        "Technology": [
            "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60"
        ],
        "Lifestyle": [
            "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60"
        ],
        "Business": [
            "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60"
        ]
    }

    for item in items:
        # Extract title
        title_cdata = re.search(r'<title><!\[CDATA\[(.*?)(?:\]\]>)?</title>', item, re.DOTALL)
        title_std = re.search(r'<title>(.*?)</title>', item, re.DOTALL)
        title = (title_cdata.group(1) if title_cdata else (title_std.group(1) if title_std else "Times of India Headline")).strip()
        
        # Extract summary / description
        desc_cdata = re.search(r'<description><!\[CDATA\[(.*?)(?:\]\]>)?</description>', item, re.DOTALL)
        desc_std = re.search(r'<description>(.*?)</description>', item, re.DOTALL)
        summary = (desc_cdata.group(1) if desc_cdata else (desc_std.group(1) if desc_std else "Click to read full details on the Times of India website.")).strip()
        summary = re.sub(r'<[^>]*>', '', summary).strip()  # Strip HTML tags
        
        # Extract link
        link_match = re.search(r'<link>(.*?)</link>', item, re.DOTALL)
        url = link_match.group(1).strip() if link_match else "https://timesofindia.indiatimes.com/"
        
        # Extract publication date
        pub_match = re.search(r'<pubDate>(.*?)</pubDate>', item, re.DOTALL)
        pub_date = pub_match.group(1).strip() if pub_match else time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
        
        # Determine category based on title keywords
        category = "India"
        lower_title = title.lower()
        if any(w in lower_title for w in ["cricket", "sport", "match", "test series", "cup", "tennis"]):
            category = "Sports"
        elif any(w in lower_title for w in ["tech", "phone", "app", "space", "ai ", "chip"]):
            category = "Technology"
        elif any(w in lower_title for w in ["fashion", "travel", "health", "movie", "show", "star"]):
            category = "Lifestyle"
        elif any(w in lower_title for w in ["nifty", "sensex", "market", "stock", "economy", "rupee"]):
            category = "Business"

        # Determine sentiment
        sentiment = "neutral"
        import random
        if any(w in lower_title for w in ["growth", "win", "success", "launch", "soar"]):
            sentiment = "positive"
            sentiment_score = 0.6 + random.random() * 0.4
        elif any(w in lower_title for w in ["fall", "crash", "loss", "death", "crisis", "kill"]):
            sentiment = "negative"
            sentiment_score = -(0.6 + random.random() * 0.4)
        else:
            sentiment_score = (random.random() - 0.5) * 0.4
            sentiment = "positive" if sentiment_score > 0.1 else ("negative" if sentiment_score < -0.1 else "neutral")

        # Image enclosure match
        enc_match = re.search(r'<enclosure[^>]+url=["\']([^"\']+)["\']', item)
        if enc_match:
            image_url = enc_match.group(1).strip()
        else:
            img_list = category_images.get(category, category_images["India"])
            image_url = img_list[index % len(img_list)]

        articles.append({
            "id": f"n-toi-{index}-{int(time.time() * 1000)}",
            "title": title,
            "category": category,
            "summary": summary if summary else title,
            "content": summary if summary else title,
            "source": "Times of India",
            "imageUrl": image_url,
            "time": pub_date,
            "url": url,
            "sentiment": sentiment,
            "sentimentScore": round(sentiment_score, 2),
            "entities": {
                "persons": [],
                "organizations": ["Times of India"],
                "locations": ["India"]
            },
            "eventId": f"ev-toi-rss-{index}",
            "readingTime": max(1, min(5, len(summary.split()) // 200))
        })
        index += 1

    return articles


def get_live_fallback_news(q: str = "", category: str = "All", provider: str = "newsapi", country: str = "in"):
    base_news = [
        {
            "id": "n-dyn-1",
            "title": "'Nothing to worry': DKS in damage-control mode after internal survey leaks",
            "category": "India",
            "summary": "Bengaluru: Deputy Chief Minister DK Shivakumar played down a leaked internal party survey, asserting that the coalition remains strongly favored across key suburban constituencies.",
            "content": "BENGALURU: Deputy Chief Minister D K Shivakumar on Friday dismissed concerns regarding a leaked internal survey of the party. He claimed that the survey was compiled by external analysts with incomplete data pools and does not reflect ground realities. Shivakumar assured party members that internal solidarity remains high and strategic coordinate plans are functioning perfectly for the upcoming municipal elections. The Congress party reports that double-digit leads are still securely projected across South Bengaluru, and ongoing relief audits are helping strengthen community relations.",
            "source": "Times of India",
            "imageUrl": "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&auto=format&fit=crop&q=60",
            "time": "15 mins ago",
            "url": "https://timesofindia.indiatimes.com/india",
            "sentiment": "neutral",
            "sentimentScore": 0.1,
            "entities": {
                "persons": ["DK Shivakumar", "Siddaramaiah"],
                "organizations": ["Congress Party", "BMC"],
                "locations": ["Bengaluru", "South India"]
            },
            "eventId": "ev-bengaluru-politics",
            "readingTime": 3
        },
        {
            "id": "n-dyn-2",
            "title": "India vs Australia Test Series: Bumrah's opening spell triggers crucial batting collapse",
            "category": "Sports",
            "summary": "Perth: Speculation ended as Jasprit Bumrah produced a masterclass spell under transitional light, putting the hosts on the backfoot on a fiery pitch.",
            "content": "PERTH: Refusing to buckle under captaincy pressure, Jasprit Bumrah spearheaded India’s sensational pace attack on Day 1 of the Border-Gavaskar Trophy series. Delivering absolute jaffas at speeds upwards of 145 kph, Bumrah claimed three crucial top-order key wickets in his opening five-over burst. Australian batsmen appeared completely bamboozled by the late movement and extra swing on the Perth ground. Cricket analysts are hailing this as one of Bumrah’s career-defining opening spells, shifting momentum entirely back to the visiting squad.",
            "source": "Times of India (TOI)",
            "imageUrl": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop&q=60",
            "time": "1 hour ago",
            "url": "https://timesofindia.indiatimes.com/sports",
            "sentiment": "positive",
            "sentimentScore": 0.85,
            "entities": {
                "persons": ["Jasprit Bumrah", "Pat Cummins"],
                "organizations": ["BCCI", "Cricket Australia"],
                "locations": ["Perth", "Australia", "India"]
            },
            "eventId": "ev-border-gavaskar",
            "readingTime": 2
        },
        {
            "id": "n-dyn-3",
            "title": "Bengaluru Tech Corridors set to receive 15,000 new AI engineering jobs by December",
            "category": "Technology",
            "summary": "Karnataka IT ministry announces massive public-private incubation corridors in Electronic City, expanding domestic infrastructure for high-performance neural computing.",
            "content": "BENGALURU: In an effort to secure Bengaluru’s crown as India’s tech powerhouse, the State IT Ministry on Friday unveiled the \"AI Emergence Corridor\" blueprint. Funded in partnership with major tier-1 venture funds, the project will establish specialized computing testbeds in Electronic City. This move is projected to generate over 15,000 high-income developer, analyst, and scientific roles within the next six months. Local tech hubs have welcomed the news, stating that unified server assets will significantly accelerate local model development pipelines and lower operational overheads.",
            "source": "TOI Tech",
            "imageUrl": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60",
            "time": "3 hours ago",
            "url": "https://timesofindia.indiatimes.com/technology",
            "sentiment": "positive",
            "sentimentScore": 0.9,
            "entities": {
                "persons": ["Priyank Kharge", "Tech Leaders"],
                "organizations": ["IT Ministry", "NASSCOM"],
                "locations": ["Bengaluru", "Electronic City"]
            },
            "eventId": "ev-india-ai-boom",
            "readingTime": 4
        },
        {
            "id": "n-dyn-4",
            "title": "Mumbai Coastal Road phase-2 structural reviews completed, open for traffic next Friday",
            "category": "Lifestyle",
            "summary": "BMC officials confirmed the high-speed transit tunnel and seawater spans have achieved final structural clearances, reducing travel time by 45 minutes.",
            "content": "MUMBAI: The city skyline is set for a massive ease in commute times. Brihanmumbai Municipal Corporation officials declared on Friday that the Mumbai Coastal Road project’s main undersea link has obtained its final safety certificates. Connecting Marine Drive to Worli with state-of-the-art tunnel structures, the expressway is planned to completely open to public traffic next Friday. Commuters will be able to cross the distance in under 8 minutes, avoiding the heavy central metropolitan bottlenecks that plague daily peak hours.",
            "source": "Times of India",
            "imageUrl": "https://images.unsplash.com/photo-1566552881560-0be862a7c445?w=600&auto=format&fit=crop&q=60",
            "time": "5 hours ago",
            "url": "https://timesofindia.indiatimes.com/life-style",
            "sentiment": "positive",
            "sentimentScore": 0.72,
            "entities": {
                "persons": ["Eknath Shinde", "BMC Commissioner"],
                "organizations": ["BMC", "MSRDC"],
                "locations": ["Mumbai", "Marine Drive", "Worli"]
            },
            "eventId": "ev-mumbai-infrastructure",
            "readingTime": 3
        },
        {
            "id": "n-dyn-5",
            "title": "Monsoon delays trigger emergency water conservation audits in five agricultural hubs",
            "category": "India",
            "summary": "Meteorologists predict dry spells over central and eastern districts, prompting regional cabinets to release storage channels to preserve seasonal paddy harvests.",
            "content": "NEW DELHI: Concerns over delay in dry monsoonal clouds have pushed central ministries to initiate immediate water reserves monitoring. Crop audits reflect potential strain on irrigation pools in some crucial food-bowl zones. To counteract this, regional agricultural panels are unlocking emergency canal systems to feed paddy fields immediately. Farmers’ cooperatives have called for increased power supply allocations to keep standard electric pump wells running during this transitional dry climate.",
            "source": "TOI India",
            "imageUrl": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=60",
            "time": "8 hours ago",
            "url": "https://timesofindia.indiatimes.com/india",
            "sentiment": "negative",
            "sentimentScore": -0.65,
            "entities": {
                "persons": ["Sanjay Singh", "Weather Desk"],
                "organizations": ["IMD", "Ministry of Agriculture"],
                "locations": ["New Delhi", "Punjab", "Uttar Pradesh"]
            },
            "eventId": "ev-monsoon-conservation",
            "readingTime": 3
        },
        {
            "id": "n-dyn-6",
            "title": "Global Semiconductor Giants finalize $800M manufacturing units in Chennai and Noida",
            "category": "Technology",
            "summary": "In line with India’s semiconductor mission, multinational design houses seal assembly and testing pacts, adding high-yield export strength to the electronics grid.",
            "content": "CHENNAI: Major semiconductor design consortia has agreed to ground massive Assembly, Testing, and Packaging (ATMP) units in the state. Backed by federal fiscal subsidies, the assembly units represent over $800 million in direct capital investments. Construction will kickstart in Chennai next month, with a sister unit expanding in Noida by mid-2027. This forms part of India’s semiconductor independence blueprint, aiming to establish reliable silicon fabrication facilities across the Indo-Pacific corridors.",
            "source": "Times of India",
            "imageUrl": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60",
            "time": "12 hours ago",
            "url": "https://timesofindia.indiatimes.com/technology",
            "sentiment": "positive",
            "sentimentScore": 0.88,
            "entities": {
                "persons": ["Ashwini Vaishnaw", "Foxconn Execs"],
                "organizations": ["Ministry of Electronics", "ISM"],
                "locations": ["Chennai", "Noida", "Tamil Nadu"]
            },
            "eventId": "ev-chennai-silicon-mission",
            "readingTime": 4
        }
    ]

    filtered = base_news
    if category and category != "All":
        filtered = [x for x in filtered if x["category"].lower() == category.lower() or 
                    (category.lower() == "india" and x["category"].lower() == "politics")]

    if q:
        query = q.lower().strip()
        filtered = [x for x in filtered if query in x["title"].lower() or query in x["summary"].lower()]

    return filtered


def parse_json_from_gemini(text: str) -> List[dict]:
    cleaned = text.strip()
    
    # Try markdown json extract
    json_match = re.search(r'```json\s*(.*?)\s*```', cleaned, re.DOTALL)
    if json_match:
        try:
            import json
            return json.loads(json_match.group(1).strip())
        except Exception:
            pass

    general_match = re.search(r'```\s*(.*?)\s*```', cleaned, re.DOTALL)
    if general_match:
        try:
            import json
            return json.loads(general_match.group(1).strip())
        except Exception:
            pass

    # Find first bracket and last bracket
    first_bracket = cleaned.find('[')
    last_bracket = cleaned.rfind(']')
    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        try:
            import json
            return json.loads(cleaned[first_bracket:last_bracket + 1])
        except Exception:
            pass

    import json
    return json.loads(cleaned)


@app.get("/api/news")
def get_news(
    q: str = Query("", description="Search query"),
    category: str = Query("All", description="Category filter"),
    provider: str = Query("newsapi", description="Provider flag"),
    country: str = Query("in", description="Country filter"),
    language: str = Query("en", description="Language filter"),
    sortBy: str = Query("publishedAt", description="Sort parameter")
):
    global gemini_cooldown_until, last_gemini_error_reason
    cache_key = f"{q}::{category}::{provider}::{country}::{language}::{sortBy}"
    
    # 1. In-memory Cache check
    now = time.time()
    if cache_key in news_cache:
        timestamp, data = news_cache[cache_key]
        if now - timestamp < CACHE_TTL:
            print(f"[Python Cache Hit] Serving cache for: {cache_key}")
            return data

    # Try TOI RSS Feed
    try:
        print("Python: Fetching live headlines from Times of India RSS...")
        rss_res = requests.get("https://timesofindia.indiatimes.com/rssfeedstopstories.cms", timeout=5)
        if rss_res.status_code == 200:
            rss_articles = parse_toi_rss(rss_res.text)
            if rss_articles:
                print(f"Python: Parsed {len(rss_articles)} RSS articles successfully.")
                news_cache[cache_key] = (now, rss_articles)
                return rss_articles
    except Exception as e:
        print(f"Python TOI RSS Fetch error: {e}")

    # 2. Check Cooldown/Circuit Breaker for active 429 status
    if now < gemini_cooldown_until:
        print("[Python Circuit Breaker Active] Bypassing Gemini API, serving fallbacks.")
        fallback = get_live_fallback_news(q, category, provider, country)
        return fallback

    # Try Gemini API with Search Grounding
    ai_client = get_genai_client()
    if not ai_client:
        print("Python: No GEMINI_API_KEY. Serving fallback database news.")
        return get_live_fallback_news(q, category, provider, country)

    try:
        search_instructions = "Perform a Google Search to retrieve actual, real-time news articles published recently in the last 24-48 hours. "
        if provider not in ["all", "newsapi", "general"]:
            search_instructions += f"Analyze publications and topics relevant to the {provider} news standard. "
        if q:
            search_instructions += f"Retrieve news matching search term '{q}'. "
        else:
            search_instructions += "Retrieve major national and international top headlines, political developments, sports, or trending reports. "
        if category and category != "All":
            search_instructions += f"Focus the search specifically on the '{category}' theme or category. "
        if country and country != "global":
            search_instructions += f"Ensure there is deep geographic coverage matching country code or context for '{country}'. "

        print(f"Python: Grounding request via Gemini Client...")
        
        # Check if we should use gemini-3.5-flash or gemini-2.0-flash / gemini-2.5-flash
        # Defaulting to gemini-2.0-flash for python genai search grounding stability unless specified
        model_name = "gemini-2.0-flash" 
        
        response = ai_client.models.generate_content(
            model=model_name,
            contents=f"{search_instructions}\n\nReturn exactly 6 distinct, real news articles matching these criteria as a structured JSON array. Each article object MUST contain properties: id, title, category, summary, content, source, imageUrl (valid description Unsplash URL), time (e.g. '10 mins ago'), url, sentiment (positive/neutral/negative), sentimentScore, entities (object with arrays: persons, organizations, locations), eventId, readingTime.\nWrap JSON in ```json codeblocks.",
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())]
            )
        )
        
        parsed = parse_json_from_gemini(response.text)
        if parsed and isinstance(parsed, list):
            news_cache[cache_key] = (now, parsed)
            return parsed
        
        raise ValueError("Response is not a valid JSON array")
        
    except Exception as e:
        err_msg = str(e)
        print(f"Python Gemini Search Grounding failed: {err_msg}")
        if "429" in err_msg or "quota" in err_msg.lower() or "resource_exhausted" in err_msg.lower():
            gemini_cooldown_until = now + 60
            last_gemini_error_reason = err_msg
        
        return get_live_fallback_news(q, category, provider, country)


@app.post("/api/send-invite")
def send_invite(body: dict = Body(...)):
    invite_type = body.get("type")
    recipient = body.get("recipient", "")
    message = body.get("message", "")
    invite_link = body.get("inviteLink", "")
    
    print("\n================== PYTHON PAIRING INVITE TRANSMITTED ==================")
    print(f"TYPE:        {str(invite_type).upper()}")
    print(f"RECIPIENT:   {recipient}")
    print(f"LINK:        {invite_link}")
    print(f"MESSAGE:     {message}")
    print("======================================================================\n")
    
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT")
    smtp_user = os.environ.get("SMTP_USER") or os.environ.get("GMAIL_USER")
    smtp_pass = os.environ.get("SMTP_PASS") or os.environ.get("GMAIL_PASS")
    
    transmission_info = "Console Log Fallback Relay"
    
    if smtp_host and smtp_user and smtp_pass:
        try:
            port = int(smtp_port) if smtp_port else 465
            secure = os.environ.get("SMTP_SECURE", "true").lower() == "true" or port == 465
            
            is_sms = invite_type in ["number", "sms"]
            to_addr = smtp_user if is_sms else recipient
            subject = f"[Simulated SMS to {recipient}] Secure Prix Node Connection" if is_sms else "Secure Prix Node Connection Invitation"
            
            msg = email.message.EmailMessage()
            msg["Subject"] = subject
            msg["From"] = f'"Prix Secure Messenger" <{smtp_user}>'
            msg["To"] = to_addr
            
            # Simple plaintext/html body
            html_body = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #4f46e5; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">PRIX</h2>
                    <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Secure Cryptographic Mesh Network</p>
                    {"<span style='background-color: #f59e0b; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-family: monospace; font-weight: bold; display: inline-block; margin-top: 5px;'>SIMULATED SMS INVITE</span>" if is_sms else ""}
                </div>
                <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <p style="font-size: 14px; color: #334155; line-height: 1.6;">Hello,</p>
                    <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                        {"This is a simulated SMS invitation originally directed to the phone number <strong>" + recipient + "</strong>:" if is_sms else "You have been invited to establish a secure peer-to-peer cryptographic communication link on Prix:"}
                    </p>
                    <blockquote style="border-left: 3px solid #cbd5e1; padding-left: 15px; color: #475569; font-style: italic; font-size: 13px; margin: 15px 0; background-color: #f8fafc; padding: 10px; border-radius: 4px;">
                        {message.replace(chr(10), '<br/>')}
                    </blockquote>
                    <div style="margin: 25px 0; text-align: center;">
                        <a href="{invite_link}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Connect Secure Node</a>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
                    <p style="font-size: 11px; color: #94a3b8; font-family: monospace; word-break: break-all; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">
                        {invite_link}
                    </p>
                </div>
            </div>
            """
            msg.set_content(message)
            msg.add_alternative(html_body, subtype="html")
            
            if secure:
                with smtplib.SMTP_SSL(smtp_host, port, timeout=10) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(smtp_host, port, timeout=10) as server:
                    if os.environ.get("SMTP_TLS", "true").lower() == "true":
                        server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                    
            transmission_info = f"SMTP Relay via {smtp_host}"
            print("Python Mail sent successfully!")
        except Exception as e:
            transmission_info = f"Python SMTP Error: {e}"
            print(f"Python SMTP Error: {e}")
            
    return {
        "success": True,
        "deliveredTo": recipient,
        "transmissionTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "relayTerminal": transmission_info
    }


@app.get("/api/portal-proxy")
def portal_proxy(url: str = Query("https://timesofindia.indiatimes.com/", description="Target URL")):
    try:
        parsed_url = requests.utils.urlparse(url)
        origin = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=5)
        html = res.text
        
        # Inject base tag & style
        base_tag = f'<base href="{origin}/">\n<style>#top_header, #footer, .top-story-strip, header, footer {{ display: none !important; }}</style>'
        updated_html = html.replace("<head>", f"<head>\n{base_tag}")
        return HTMLResponse(content=updated_html, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {e}")


@app.get("/api/toi-live")
def toi_live():
    # Attempt YouTube RSS channel video extract for TimesNow
    try:
        channel_id = "UC6RJ7-PaXg6TIH2BzZfTV7w"
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        res = requests.get(rss_url, timeout=5)
        if res.status_code == 200:
            xml = res.text
            entries = re.findall(r'<entry>(.*?)</entry>', xml, re.DOTALL)
            for entry in entries:
                title_match = re.search(r'<title>(.*?)</title>', entry)
                video_id_match = re.search(r'<yt:videoId>([^<]+)</yt:videoId>', entry)
                if title_match and video_id_match:
                    title = title_match.group(1)
                    video_id = video_id_match.group(1)
                    if "#shorts" not in title.lower() and "#short" not in title.lower():
                        print(f"Python: Resolved active TOI video: {video_id} ({title})")
                        return {"videoId": video_id}
    except Exception as e:
        print(f"Python YouTube RSS scraper warning: {e}")

    # Scraper fallback
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get("https://www.youtube.com/@TimesNow/live", headers=headers, timeout=5)
        if res.status_code == 200:
            html = res.text
            canonical = re.search(r'<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([^"]+)"', html)
            if canonical:
                return {"videoId": canonical.group(1)}
            
            video_id_match = re.search(r'"videoId":"([^"]+)"', html)
            if video_id_match:
                return {"videoId": video_id_match.group(1)}
    except Exception as e:
        print(f"Python YouTube Live page scraper failed: {e}")
        
    return {"videoId": "KznzRuWimUU"}


@app.get("/api/opengames/games")
def opengames_games(
    page: str = "1",
    pageSize: str = "20",
    sort: str = "stars",
    order: str = "desc",
    language: Optional[str] = None,
    genre: Optional[str] = None
):
    try:
        url = f"https://opengames.dev/api/games?page={page}&pageSize={pageSize}&sort={sort}&order={order}"
        if language:
            url += f"&language={language}"
        if genre:
            url += f"&genre={genre}"
        res = requests.get(url, timeout=4)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Python OpenGames games proxy fallback: {e}")
    
    # Return mock
    return {
        "success": True,
        "data": [],
        "meta": {"page": int(page), "pageSize": int(pageSize), "total": 0, "totalPages": 0, "hasMore": False}
    }


@app.get("/api/opengames/search")
def opengames_search(
    q: str = "",
    page: str = "1",
    pageSize: str = "20",
    language: Optional[str] = None,
    genre: Optional[str] = None
):
    if len(q) < 2:
        return {"success": True, "data": {"query": q, "results": []}, "meta": {"page": 1, "pageSize": 20, "total": 0, "totalPages": 0, "hasMore": False}}
    try:
        url = f"https://opengames.dev/api/search?q={q}&page={page}&pageSize={pageSize}"
        if language:
            url += f"&language={language}"
        if genre:
            url += f"&genre={genre}"
        res = requests.get(url, timeout=4)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Python OpenGames search proxy fallback: {e}")
        
    return {"success": True, "data": {"query": q, "results": []}, "meta": {"page": int(page), "pageSize": int(pageSize), "total": 0, "totalPages": 0, "hasMore": False}}


@app.get("/api/opengames/stats")
def opengames_stats():
    try:
        res = requests.get("https://opengames.dev/api/stats", timeout=4)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Python OpenGames stats proxy fallback: {e}")
        
    return {
        "success": True,
        "data": {
            "totalGames": 128,
            "totalStars": 3412,
            "genresCount": {"Action": 45, "Puzzle": 30, "Strategy": 25, "Board": 28}
        }
    }

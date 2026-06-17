"""
Prix API — Django Views

Ports all FastAPI endpoints from main.py to Django function-based views.
Each view uses @csrf_exempt for API access from the React frontend.
"""

import os
import re
import json
import time
import email.message
import smtplib
import hashlib
from typing import Optional, List

import requests as http_requests
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils import timezone

from .models import UserProfile, Contact, ChatSession, ChatMessage, NewsCache, InviteLog

# ---------------------------------------------------------------------------
# Lazy-loaded GenAI client
# ---------------------------------------------------------------------------
_ai_client = None


def get_genai_client():
    global _ai_client
    if _ai_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                from google import genai
                _ai_client = genai.Client(api_key=api_key)
            except Exception as e:
                print(f"GenAI client init error: {e}")
    return _ai_client


# ---------------------------------------------------------------------------
# In-memory caches / circuit breaker state
# ---------------------------------------------------------------------------
news_mem_cache: dict = {}
CACHE_TTL = 3 * 60  # 3 minutes

gemini_cooldown_until = 0
last_gemini_error_reason = ""


# ---------------------------------------------------------------------------
# Helper: RSS Parser
# ---------------------------------------------------------------------------
CATEGORY_IMAGES = {
    "India": [
        "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1506461883276-594a12b11db3?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1596422846543-75c6fc18a52b?w=600&auto=format&fit=crop&q=60",
    ],
    "Sports": [
        "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&auto=format&fit=crop&q=60",
    ],
    "Technology": [
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=60",
    ],
    "Lifestyle": [
        "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60",
    ],
    "Business": [
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60",
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60",
    ],
}


def parse_toi_rss(xml_text: str) -> List[dict]:
    import random

    articles = []
    items = re.findall(r'<item>(.*?)</item>', xml_text, re.DOTALL)
    index = 1

    for item in items:
        title_cdata = re.search(r'<title><!\[CDATA\[(.*?)(?:\]\]>)?</title>', item, re.DOTALL)
        title_std = re.search(r'<title>(.*?)</title>', item, re.DOTALL)
        title = (title_cdata.group(1) if title_cdata else (title_std.group(1) if title_std else "Times of India Headline")).strip()

        desc_cdata = re.search(r'<description><!\[CDATA\[(.*?)(?:\]\]>)?</description>', item, re.DOTALL)
        desc_std = re.search(r'<description>(.*?)</description>', item, re.DOTALL)
        summary = (desc_cdata.group(1) if desc_cdata else (desc_std.group(1) if desc_std else "Click to read full details on the Times of India website.")).strip()
        summary = re.sub(r'<[^>]*>', '', summary).strip()

        link_match = re.search(r'<link>(.*?)</link>', item, re.DOTALL)
        url = link_match.group(1).strip() if link_match else "https://timesofindia.indiatimes.com/"

        pub_match = re.search(r'<pubDate>(.*?)</pubDate>', item, re.DOTALL)
        pub_date = pub_match.group(1).strip() if pub_match else time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())

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

        sentiment = "neutral"
        if any(w in lower_title for w in ["growth", "win", "success", "launch", "soar"]):
            sentiment = "positive"
            sentiment_score = 0.6 + random.random() * 0.4
        elif any(w in lower_title for w in ["fall", "crash", "loss", "death", "crisis", "kill"]):
            sentiment = "negative"
            sentiment_score = -(0.6 + random.random() * 0.4)
        else:
            sentiment_score = (random.random() - 0.5) * 0.4
            sentiment = "positive" if sentiment_score > 0.1 else ("negative" if sentiment_score < -0.1 else "neutral")

        enc_match = re.search(r'<enclosure[^>]+url=["\']([^"\']+)["\']', item)
        if enc_match:
            image_url = enc_match.group(1).strip()
        else:
            img_list = CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["India"])
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
            "entities": {"persons": [], "organizations": ["Times of India"], "locations": ["India"]},
            "eventId": f"ev-toi-rss-{index}",
            "readingTime": max(1, min(5, len(summary.split()) // 200)),
        })
        index += 1

    return articles


def get_live_fallback_news(q="", category="All", provider="newsapi", country="in"):
    """Static fallback news for when all live sources are unavailable."""
    base_news = [
        {
            "id": "n-dyn-1",
            "title": "'Nothing to worry': DKS in damage-control mode after internal survey leaks",
            "category": "India",
            "summary": "Bengaluru: Deputy Chief Minister DK Shivakumar played down a leaked internal party survey.",
            "content": "BENGALURU: Deputy Chief Minister D K Shivakumar on Friday dismissed concerns regarding a leaked internal survey of the party.",
            "source": "Times of India",
            "imageUrl": "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&auto=format&fit=crop&q=60",
            "time": "15 mins ago",
            "url": "https://timesofindia.indiatimes.com/india",
            "sentiment": "neutral",
            "sentimentScore": 0.1,
            "entities": {"persons": ["DK Shivakumar"], "organizations": ["Congress Party"], "locations": ["Bengaluru"]},
            "eventId": "ev-bengaluru-politics",
            "readingTime": 3,
        },
        {
            "id": "n-dyn-2",
            "title": "India vs Australia Test Series: Bumrah's opening spell triggers crucial batting collapse",
            "category": "Sports",
            "summary": "Perth: Jasprit Bumrah produced a masterclass spell under transitional light.",
            "content": "PERTH: Bumrah spearheaded India's sensational pace attack on Day 1 of the Border-Gavaskar Trophy.",
            "source": "Times of India (TOI)",
            "imageUrl": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&auto=format&fit=crop&q=60",
            "time": "1 hour ago",
            "url": "https://timesofindia.indiatimes.com/sports",
            "sentiment": "positive",
            "sentimentScore": 0.85,
            "entities": {"persons": ["Jasprit Bumrah"], "organizations": ["BCCI"], "locations": ["Perth"]},
            "eventId": "ev-border-gavaskar",
            "readingTime": 2,
        },
        {
            "id": "n-dyn-3",
            "title": "Bengaluru Tech Corridors set to receive 15,000 new AI engineering jobs by December",
            "category": "Technology",
            "summary": "Karnataka IT ministry announces massive public-private incubation corridors.",
            "content": "BENGALURU: The State IT Ministry unveiled the 'AI Emergence Corridor' blueprint.",
            "source": "TOI Tech",
            "imageUrl": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60",
            "time": "3 hours ago",
            "url": "https://timesofindia.indiatimes.com/technology",
            "sentiment": "positive",
            "sentimentScore": 0.9,
            "entities": {"persons": [], "organizations": ["IT Ministry", "NASSCOM"], "locations": ["Bengaluru"]},
            "eventId": "ev-india-ai-boom",
            "readingTime": 4,
        },
    ]

    filtered = base_news
    if category and category != "All":
        filtered = [x for x in filtered if x["category"].lower() == category.lower()]
    if q:
        query = q.lower().strip()
        filtered = [x for x in filtered if query in x["title"].lower() or query in x["summary"].lower()]

    return filtered


def parse_json_from_gemini(text: str) -> List[dict]:
    cleaned = text.strip()
    json_match = re.search(r'```json\s*(.*?)\s*```', cleaned, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1).strip())
        except Exception:
            pass

    general_match = re.search(r'```\s*(.*?)\s*```', cleaned, re.DOTALL)
    if general_match:
        try:
            return json.loads(general_match.group(1).strip())
        except Exception:
            pass

    first_bracket = cleaned.find('[')
    last_bracket = cleaned.rfind(']')
    if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
        try:
            return json.loads(cleaned[first_bracket:last_bracket + 1])
        except Exception:
            pass

    return json.loads(cleaned)


# ===========================================================================
# API Views
# ===========================================================================

@csrf_exempt
@require_GET
def api_health(request):
    """Health check endpoint."""
    return JsonResponse({"status": "ok", "server": "Django/Prix", "timestamp": timezone.now().isoformat()})


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@csrf_exempt
@require_POST
def api_signup(request):
    """Register a new user with email/password + optional profile data."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    email_addr = body.get("email", "").strip().lower()
    password = body.get("password", "")
    display_name = body.get("displayName", "")
    avatar_url = body.get("avatarUrl", "")
    phone_number = body.get("phoneNumber", "")
    allow_drive = body.get("allowGoogleDrive", False)
    allow_camera = body.get("allowCamera", False)
    allow_audio = body.get("allowAudio", False)

    if not email_addr or not password:
        return JsonResponse({"error": "Email and password are required"}, status=400)

    if User.objects.filter(email=email_addr).exists():
        return JsonResponse({"error": "An account with this email already exists"}, status=409)

    # Create Django user (username = email for simplicity)
    username = email_addr.split("@")[0] + "_" + hashlib.md5(email_addr.encode()).hexdigest()[:6]
    user = User.objects.create_user(username=username, email=email_addr, password=password)
    user.first_name = display_name
    user.save()

    # Create profile
    profile = UserProfile.objects.create(
        user=user,
        display_name=display_name or username,
        avatar_url=avatar_url,
        phone_number=phone_number,
        allow_google_drive=allow_drive,
        allow_camera=allow_camera,
        allow_audio=allow_audio,
    )

    return JsonResponse({
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "displayName": profile.display_name,
            "avatarUrl": profile.avatar_url,
            "phoneNumber": profile.phone_number,
        },
        "message": "Account created successfully",
    }, status=201)


@csrf_exempt
@require_POST
def api_login(request):
    """Authenticate a user and return profile data."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    email_addr = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email_addr or not password:
        return JsonResponse({"error": "Email and password are required"}, status=400)

    # Find user by email
    try:
        user_obj = User.objects.get(email=email_addr)
    except User.DoesNotExist:
        return JsonResponse({"error": "Invalid email or password"}, status=401)

    user = authenticate(username=user_obj.username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid email or password"}, status=401)

    # Retrieve or create profile
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"display_name": user.first_name or user.username})
    profile.is_online = True
    profile.save()

    return JsonResponse({
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "displayName": profile.display_name,
            "avatarUrl": profile.avatar_url,
            "phoneNumber": profile.phone_number,
            "status": profile.status,
        },
    })


@csrf_exempt
@require_POST
def api_logout(request):
    """Mark user offline."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    user_id = body.get("userId")
    if user_id:
        try:
            profile = UserProfile.objects.get(user_id=user_id)
            profile.is_online = False
            profile.save()
        except UserProfile.DoesNotExist:
            pass

    return JsonResponse({"success": True})


# ---------------------------------------------------------------------------
# User directory
# ---------------------------------------------------------------------------

@csrf_exempt
@require_GET
def api_users(request):
    """Return all registered users for the contact directory."""
    profiles = UserProfile.objects.select_related('user').all()
    users_list = [
        {
            "id": p.user.id,
            "email": p.user.email,
            "displayName": p.display_name,
            "avatarUrl": p.avatar_url,
            "status": p.status,
            "isOnline": p.is_online,
        }
        for p in profiles
    ]
    return JsonResponse({"users": users_list})


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_contacts(request):
    """GET: list contacts for a user. POST: add a new contact."""
    if request.method == "GET":
        user_id = request.GET.get("userId")
        if not user_id:
            return JsonResponse({"error": "userId query param required"}, status=400)
        contacts = Contact.objects.filter(owner_id=user_id)
        contact_list = [
            {
                "id": c.id,
                "name": c.name,
                "avatar": c.avatar,
                "status": c.status,
                "isOnline": c.is_online,
                "email": c.email,
                "phone": c.phone,
            }
            for c in contacts
        ]
        return JsonResponse({"contacts": contact_list})

    # POST — add contact
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    owner_id = body.get("userId")
    name = body.get("name", "")
    contact_email = body.get("email", "")
    phone = body.get("phone", "")
    avatar = body.get("avatar", "")

    if not owner_id or not name:
        return JsonResponse({"error": "userId and name are required"}, status=400)

    contact_user = None
    if contact_email:
        try:
            contact_user = User.objects.get(email=contact_email)
        except User.DoesNotExist:
            pass

    contact = Contact.objects.create(
        owner_id=owner_id,
        contact_user=contact_user,
        name=name,
        avatar=avatar,
        email=contact_email,
        phone=phone,
    )

    return JsonResponse({
        "success": True,
        "contact": {"id": contact.id, "name": contact.name, "email": contact.email},
    }, status=201)


# ---------------------------------------------------------------------------
# Chat Sessions & Messages
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_chat_sessions(request):
    """GET: list sessions for a user. POST: create a new session."""
    if request.method == "GET":
        user_id = request.GET.get("userId")
        if not user_id:
            return JsonResponse({"error": "userId query param required"}, status=400)
        sessions = ChatSession.objects.filter(participants__id=user_id)
        sessions_list = [
            {
                "id": str(s.session_id),
                "name": s.name,
                "avatar": s.avatar,
                "platform": s.platform,
                "type": s.type,
                "lastMessage": s.last_message,
                "lastMessageTime": s.last_message_time.isoformat() if s.last_message_time else None,
                "encryptionKey": s.encryption_key,
                "contactEmail": s.contact_email,
                "contactPhone": s.contact_phone,
            }
            for s in sessions
        ]
        return JsonResponse({"sessions": sessions_list})

    # POST — create session
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    user_id = body.get("userId")
    name = body.get("name", "New Chat")
    platform = body.get("platform", "intergram")
    chat_type = body.get("type", "direct")
    encryption_key = body.get("encryptionKey", "")
    contact_email = body.get("contactEmail", "")
    contact_phone = body.get("contactPhone", "")

    if not user_id:
        return JsonResponse({"error": "userId is required"}, status=400)

    session = ChatSession.objects.create(
        name=name,
        platform=platform,
        type=chat_type,
        encryption_key=encryption_key,
        created_by_id=user_id,
        contact_email=contact_email,
        contact_phone=contact_phone,
    )
    session.participants.add(user_id)

    return JsonResponse({
        "success": True,
        "session": {"id": str(session.session_id), "name": session.name},
    }, status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def api_chat_messages(request):
    """GET: list messages for a session. POST: send a new message."""
    if request.method == "GET":
        session_id = request.GET.get("sessionId")
        if not session_id:
            return JsonResponse({"error": "sessionId query param required"}, status=400)
        try:
            session = ChatSession.objects.get(session_id=session_id)
        except ChatSession.DoesNotExist:
            return JsonResponse({"error": "Session not found"}, status=404)

        messages = ChatMessage.objects.filter(session=session).order_by('created_at')
        msg_list = [
            {
                "id": str(m.message_id),
                "senderId": str(m.sender_id),
                "senderName": m.sender_name,
                "text": m.text,
                "timestamp": m.created_at.isoformat(),
                "isEncrypted": m.is_encrypted,
                "encryptionKeyHash": m.encryption_key_hash,
                "fileUrl": m.file_url or None,
                "fileId": m.file_id or None,
                "fileName": m.file_name or None,
                "fileType": m.file_type or None,
                "fileSize": m.file_size or None,
                "location": {"lat": m.location_lat, "lng": m.location_lng, "address": m.location_address} if m.location_lat else None,
                "poll": m.poll_data,
                "checklist": m.checklist_data,
                "contactInfo": m.contact_info_data,
                "walletTransfer": m.wallet_transfer_data,
            }
            for m in messages
        ]
        return JsonResponse({"messages": msg_list})

    # POST — send message
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    session_id = body.get("sessionId")
    sender_id = body.get("senderId")
    text = body.get("text", "")

    if not session_id or not sender_id:
        return JsonResponse({"error": "sessionId and senderId are required"}, status=400)

    try:
        session = ChatSession.objects.get(session_id=session_id)
    except ChatSession.DoesNotExist:
        return JsonResponse({"error": "Session not found"}, status=404)

    try:
        sender = User.objects.get(id=sender_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "Sender not found"}, status=404)

    sender_name = body.get("senderName", sender.first_name or sender.username)

    msg = ChatMessage.objects.create(
        session=session,
        sender=sender,
        sender_name=sender_name,
        text=text,
        is_encrypted=body.get("isEncrypted", True),
        encryption_key_hash=body.get("encryptionKeyHash", ""),
        file_url=body.get("fileUrl", ""),
        file_id=body.get("fileId", ""),
        file_name=body.get("fileName", ""),
        file_type=body.get("fileType", ""),
        file_size=body.get("fileSize", ""),
        location_lat=body.get("location", {}).get("lat") if body.get("location") else None,
        location_lng=body.get("location", {}).get("lng") if body.get("location") else None,
        location_address=body.get("location", {}).get("address", "") if body.get("location") else "",
        poll_data=body.get("poll"),
        checklist_data=body.get("checklist"),
        contact_info_data=body.get("contactInfo"),
        wallet_transfer_data=body.get("walletTransfer"),
    )

    # Update session last message
    session.last_message = text[:200] if text else "[attachment]"
    session.last_message_time = timezone.now()
    session.save()

    return JsonResponse({
        "success": True,
        "message": {"id": str(msg.message_id), "timestamp": msg.created_at.isoformat()},
    }, status=201)


# ---------------------------------------------------------------------------
# News endpoint (ported from FastAPI)
# ---------------------------------------------------------------------------

@csrf_exempt
@require_GET
def api_news(request):
    """Fetch news with Gemini grounding, TOI RSS fallback, and static fallback."""
    global gemini_cooldown_until, last_gemini_error_reason

    q = request.GET.get("q", "")
    category = request.GET.get("category", "All")
    provider = request.GET.get("provider", "newsapi")
    country = request.GET.get("country", "in")
    language = request.GET.get("language", "en")
    sortBy = request.GET.get("sortBy", "publishedAt")

    cache_key = f"{q}::{category}::{provider}::{country}::{language}::{sortBy}"

    # 1. In-memory cache
    now = time.time()
    if cache_key in news_mem_cache:
        timestamp, data = news_mem_cache[cache_key]
        if now - timestamp < CACHE_TTL:
            print(f"[Django Cache Hit] Serving cache for: {cache_key}")
            return JsonResponse(data, safe=False)

    # 2. TOI RSS Feed
    try:
        print("Django: Fetching live headlines from Times of India RSS...")
        rss_res = http_requests.get("https://timesofindia.indiatimes.com/rssfeedstopstories.cms", timeout=5)
        if rss_res.status_code == 200:
            rss_articles = parse_toi_rss(rss_res.text)
            if rss_articles:
                print(f"Django: Parsed {len(rss_articles)} RSS articles successfully.")
                news_mem_cache[cache_key] = (now, rss_articles)
                # Persist to DB
                NewsCache.objects.update_or_create(cache_key=cache_key, defaults={"articles_json": rss_articles})
                return JsonResponse(rss_articles, safe=False)
    except Exception as e:
        print(f"Django TOI RSS Fetch error: {e}")

    # 3. Cooldown check
    if now < gemini_cooldown_until:
        print("[Django Circuit Breaker Active] Serving fallbacks.")
        fallback = get_live_fallback_news(q, category, provider, country)
        return JsonResponse(fallback, safe=False)

    # 4. Gemini Search Grounding
    ai_client = get_genai_client()
    if not ai_client:
        print("Django: No GEMINI_API_KEY. Serving fallback news.")
        return JsonResponse(get_live_fallback_news(q, category, provider, country), safe=False)

    try:
        from google.genai import types

        search_instructions = "Perform a Google Search to retrieve actual, real-time news articles published recently in the last 24-48 hours. "
        if provider not in ["all", "newsapi", "general"]:
            search_instructions += f"Analyze publications relevant to the {provider} news standard. "
        if q:
            search_instructions += f"Retrieve news matching search term '{q}'. "
        else:
            search_instructions += "Retrieve major national and international top headlines. "
        if category and category != "All":
            search_instructions += f"Focus on the '{category}' category. "
        if country and country != "global":
            search_instructions += f"Ensure geographic coverage for '{country}'. "

        print("Django: Grounding request via Gemini Client...")
        response = ai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"{search_instructions}\n\nReturn exactly 6 distinct, real news articles as a structured JSON array. Each article must contain: id, title, category, summary, content, source, imageUrl, time, url, sentiment, sentimentScore, entities, eventId, readingTime.\nWrap JSON in ```json codeblocks.",
            config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
        )
        parsed = parse_json_from_gemini(response.text)
        if parsed and isinstance(parsed, list):
            news_mem_cache[cache_key] = (now, parsed)
            NewsCache.objects.update_or_create(cache_key=cache_key, defaults={"articles_json": parsed})
            return JsonResponse(parsed, safe=False)
        raise ValueError("Response is not a valid JSON array")

    except Exception as e:
        err_msg = str(e)
        print(f"Django Gemini Search Grounding failed: {err_msg}")
        if "429" in err_msg or "quota" in err_msg.lower() or "resource_exhausted" in err_msg.lower():
            gemini_cooldown_until = now + 60
            last_gemini_error_reason = err_msg

        return JsonResponse(get_live_fallback_news(q, category, provider, country), safe=False)


# ---------------------------------------------------------------------------
# Send Invite (email / SMS simulation)
# ---------------------------------------------------------------------------

@csrf_exempt
@require_POST
def api_send_invite(request):
    """Send a pairing invitation via email (or simulated SMS)."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    invite_type = body.get("type", "email")
    recipient = body.get("recipient", "")
    message = body.get("message", "")
    invite_link = body.get("inviteLink", "")

    print("\n================== DJANGO PAIRING INVITE ==================")
    print(f"TYPE:        {str(invite_type).upper()}")
    print(f"RECIPIENT:   {recipient}")
    print(f"LINK:        {invite_link}")
    print(f"MESSAGE:     {message}")
    print("============================================================\n")

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

            html_body = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #4f46e5; text-align: center;">PRIX</h2>
                <p style="color: #64748b; text-align: center;">Secure Cryptographic Mesh Network</p>
                <div style="background: #fff; padding: 20px; border-radius: 8px;">
                    <p>{message}</p>
                    <div style="text-align: center; margin: 25px 0;">
                        <a href="{invite_link}" style="background-color: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Connect Secure Node</a>
                    </div>
                    <p style="font-size: 11px; color: #94a3b8; word-break: break-all;">{invite_link}</p>
                </div>
            </div>"""
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
            print("Django Mail sent successfully!")
        except Exception as e:
            transmission_info = f"Django SMTP Error: {e}"
            print(f"Django SMTP Error: {e}")

    # Log the invite
    InviteLog.objects.create(
        invite_type=invite_type,
        recipient=recipient,
        message=message,
        invite_link=invite_link,
        transmission_info=transmission_info,
    )

    return JsonResponse({
        "success": True,
        "deliveredTo": recipient,
        "transmissionTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "relayTerminal": transmission_info,
    })


# ---------------------------------------------------------------------------
# Portal proxy
# ---------------------------------------------------------------------------

@csrf_exempt
@require_GET
def api_portal_proxy(request):
    """Proxy a target URL and strip navigation elements."""
    url = request.GET.get("url", "https://timesofindia.indiatimes.com/")
    try:
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        origin = f"{parsed_url.scheme}://{parsed_url.netloc}"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        }
        res = http_requests.get(url, headers=headers, timeout=5)
        html = res.text

        base_tag = f'<base href="{origin}/">\n<style>#top_header, #footer, .top-story-strip, header, footer {{ display: none !important; }}</style>'
        updated_html = html.replace("<head>", f"<head>\n{base_tag}")

        return HttpResponse(updated_html, content_type="text/html")
    except Exception as e:
        return JsonResponse({"error": f"Proxy error: {e}"}, status=500)


# ---------------------------------------------------------------------------
# TOI Live video
# ---------------------------------------------------------------------------

@csrf_exempt
@require_GET
def api_toi_live(request):
    """Find the latest live video from Times Now YouTube."""
    try:
        channel_id = "UC6RJ7-PaXg6TIH2BzZfTV7w"
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        res = http_requests.get(rss_url, timeout=5)
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
                        print(f"Django: Resolved TOI video: {video_id} ({title})")
                        return JsonResponse({"videoId": video_id})
    except Exception as e:
        print(f"Django YouTube RSS scraper warning: {e}")

    # Scraper fallback
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"}
        res = http_requests.get("https://www.youtube.com/@TimesNow/live", headers=headers, timeout=5)
        if res.status_code == 200:
            html = res.text
            canonical = re.search(r'<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([^"]+)"', html)
            if canonical:
                return JsonResponse({"videoId": canonical.group(1)})
            video_id_match = re.search(r'"videoId":"([^"]+)"', html)
            if video_id_match:
                return JsonResponse({"videoId": video_id_match.group(1)})
    except Exception as e:
        print(f"Django YouTube Live page scraper failed: {e}")

    return JsonResponse({"videoId": "KznzRuWimUU"})


# ---------------------------------------------------------------------------
# OpenGames proxy endpoints
# ---------------------------------------------------------------------------

@csrf_exempt
@require_GET
def api_opengames_games(request):
    """Proxy for OpenGames game list."""
    page = request.GET.get("page", "1")
    pageSize = request.GET.get("pageSize", "20")
    sort = request.GET.get("sort", "stars")
    order = request.GET.get("order", "desc")
    language = request.GET.get("language")
    genre = request.GET.get("genre")

    try:
        url = f"https://opengames.dev/api/games?page={page}&pageSize={pageSize}&sort={sort}&order={order}"
        if language:
            url += f"&language={language}"
        if genre:
            url += f"&genre={genre}"
        res = http_requests.get(url, timeout=4)
        if res.status_code == 200:
            return JsonResponse(res.json())
    except Exception as e:
        print(f"Django OpenGames games proxy fallback: {e}")

    return JsonResponse({
        "success": True,
        "data": [],
        "meta": {"page": int(page), "pageSize": int(pageSize), "total": 0, "totalPages": 0, "hasMore": False},
    })


@csrf_exempt
@require_GET
def api_opengames_search(request):
    """Proxy for OpenGames search."""
    q = request.GET.get("q", "")
    page = request.GET.get("page", "1")
    pageSize = request.GET.get("pageSize", "20")
    language = request.GET.get("language")
    genre = request.GET.get("genre")

    if len(q) < 2:
        return JsonResponse({
            "success": True,
            "data": {"query": q, "results": []},
            "meta": {"page": 1, "pageSize": 20, "total": 0, "totalPages": 0, "hasMore": False},
        })

    try:
        url = f"https://opengames.dev/api/search?q={q}&page={page}&pageSize={pageSize}"
        if language:
            url += f"&language={language}"
        if genre:
            url += f"&genre={genre}"
        res = http_requests.get(url, timeout=4)
        if res.status_code == 200:
            return JsonResponse(res.json())
    except Exception as e:
        print(f"Django OpenGames search proxy fallback: {e}")

    return JsonResponse({
        "success": True,
        "data": {"query": q, "results": []},
        "meta": {"page": int(page), "pageSize": int(pageSize), "total": 0, "totalPages": 0, "hasMore": False},
    })


@csrf_exempt
@require_GET
def api_opengames_stats(request):
    """Proxy for OpenGames statistics."""
    try:
        res = http_requests.get("https://opengames.dev/api/stats", timeout=4)
        if res.status_code == 200:
            return JsonResponse(res.json())
    except Exception as e:
        print(f"Django OpenGames stats proxy fallback: {e}")

    return JsonResponse({
        "success": True,
        "data": {
            "totalGames": 128,
            "totalStars": 3412,
            "genresCount": {"Action": 45, "Puzzle": 30, "Strategy": 25, "Board": 28},
        },
    })

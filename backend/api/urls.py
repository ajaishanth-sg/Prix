"""
Prix API — URL Configuration

Maps all API endpoints to their corresponding Django views.
All endpoints are prefixed with /api/ by the project-level urls.py.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Health check
    path('health/', views.api_health, name='api_health'),

    # Auth
    path('signup/', views.api_signup, name='api_signup'),
    path('login/', views.api_login, name='api_login'),
    path('logout/', views.api_logout, name='api_logout'),

    # User directory
    path('users/', views.api_users, name='api_users'),

    # Contacts
    path('contacts/', views.api_contacts, name='api_contacts'),

    # Chat
    path('chat/sessions/', views.api_chat_sessions, name='api_chat_sessions'),
    path('chat/messages/', views.api_chat_messages, name='api_chat_messages'),

    # News
    path('news/', views.api_news, name='api_news'),

    # Invite
    path('send-invite/', views.api_send_invite, name='api_send_invite'),

    # Portal proxy
    path('portal-proxy/', views.api_portal_proxy, name='api_portal_proxy'),

    # TOI Live
    path('toi-live/', views.api_toi_live, name='api_toi_live'),

    # OpenGames
    path('opengames/games/', views.api_opengames_games, name='api_opengames_games'),
    path('opengames/search/', views.api_opengames_search, name='api_opengames_search'),
    path('opengames/stats/', views.api_opengames_stats, name='api_opengames_stats'),
]

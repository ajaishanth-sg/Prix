"""
Prix API — Django Models

Maps the Firestore document schema and frontend TypeScript types to
PostgreSQL-backed Django ORM models.
"""

from django.db import models
from django.contrib.auth.models import User
import uuid


class UserProfile(models.Model):
    """Extended user profile linked to Django's built-in User model."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=100, blank=True, default='')
    avatar_url = models.URLField(max_length=500, blank=True, default='')
    phone_number = models.CharField(max_length=20, blank=True, default='')
    status = models.CharField(max_length=200, default='Available on Prix')
    is_online = models.BooleanField(default=False)
    # Device permissions stored as JSON for flexibility
    allow_google_drive = models.BooleanField(default=False)
    allow_camera = models.BooleanField(default=False)
    allow_audio = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.display_name or self.user.username} (Profile)"

    class Meta:
        db_table = 'user_profiles'
        ordering = ['-created_at']


class Contact(models.Model):
    """A contact relationship between two users."""
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    contact_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacted_by', null=True, blank=True)
    name = models.CharField(max_length=100)
    avatar = models.URLField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=200, default='Available')
    is_online = models.BooleanField(default=False)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.owner.username} -> {self.name}"

    class Meta:
        db_table = 'contacts'
        unique_together = ['owner', 'email']
        ordering = ['name']


class ChatSession(models.Model):
    """A chat session / conversation thread."""
    PLATFORM_CHOICES = [
        ('intergram', 'Intergram'),
        ('telegram', 'Telegram'),
        ('whatsapp', 'WhatsApp'),
    ]
    TYPE_CHOICES = [
        ('direct', 'Direct'),
        ('group', 'Group'),
        ('bridge', 'Bridge'),
    ]

    session_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=200)
    avatar = models.URLField(max_length=500, blank=True, default='')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='intergram')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='direct')
    encryption_key = models.TextField(blank=True, default='')
    last_message = models.TextField(blank=True, default='')
    last_message_time = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_sessions')
    participants = models.ManyToManyField(User, related_name='chat_sessions', blank=True)
    contact_email = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Chat: {self.name} ({self.platform})"

    class Meta:
        db_table = 'chat_sessions'
        ordering = ['-updated_at']


class ChatMessage(models.Model):
    """Individual message within a chat session."""
    FILE_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('audio', 'Audio'),
        ('document', 'Document'),
    ]

    message_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    sender_name = models.CharField(max_length=100)
    text = models.TextField(blank=True, default='')
    is_encrypted = models.BooleanField(default=True)
    encryption_key_hash = models.CharField(max_length=128, blank=True, default='')
    # File attachment fields
    file_url = models.URLField(max_length=1000, blank=True, default='')
    file_id = models.CharField(max_length=200, blank=True, default='')
    file_name = models.CharField(max_length=300, blank=True, default='')
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, blank=True, default='')
    file_size = models.CharField(max_length=50, blank=True, default='')
    # Location
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    location_address = models.TextField(blank=True, default='')
    # Rich content stored as JSON
    poll_data = models.JSONField(null=True, blank=True)
    checklist_data = models.JSONField(null=True, blank=True)
    contact_info_data = models.JSONField(null=True, blank=True)
    wallet_transfer_data = models.JSONField(null=True, blank=True)
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Msg by {self.sender_name}: {self.text[:50]}"

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']


class NewsCache(models.Model):
    """Server-side news cache for offline/fallback access."""
    cache_key = models.CharField(max_length=500, unique=True)
    articles_json = models.JSONField(default=list)
    fetched_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cache: {self.cache_key[:60]}"

    class Meta:
        db_table = 'news_cache'


class InviteLog(models.Model):
    """Log of pairing invitations sent via email/SMS."""
    INVITE_TYPE_CHOICES = [
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('number', 'Phone Number'),
    ]

    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_invites')
    invite_type = models.CharField(max_length=10, choices=INVITE_TYPE_CHOICES)
    recipient = models.CharField(max_length=200)
    message = models.TextField(blank=True, default='')
    invite_link = models.URLField(max_length=1000, blank=True, default='')
    transmission_info = models.CharField(max_length=300, blank=True, default='')
    success = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite to {self.recipient} ({self.invite_type})"

    class Meta:
        db_table = 'invite_logs'
        ordering = ['-created_at']

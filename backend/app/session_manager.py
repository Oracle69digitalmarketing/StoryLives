import redis
import json
import os
from typing import Dict, Any

class SessionManager:
    def __init__(self):
        # Initialize Redis client (assuming Redis is accessible via environment variable)
        self.redis_client = redis.Redis.from_url(
            os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        )
    
    async def load_session(self, session_id: str) -> Dict[str, Any]:
        """Load session data from Redis."""
        session_data = self.redis_client.get(session_id)
        if session_data:
            return json.loads(session_data)
        return {"story_history": [], "current_state": {}}
    
    async def save_session(self, session_id: str, data: Dict[str, Any]):
        """Save session data to Redis."""
        self.redis_client.set(session_id, json.dumps(data))
    
    async def update_session_context(self, session_id: str, new_context: Dict[str, Any]):
        """Update a specific part of the session context."""
        current_session = await self.load_session(session_id)
        current_session.update(new_context)
        await self.save_session(session_id, current_session)

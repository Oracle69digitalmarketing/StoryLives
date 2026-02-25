import os
import hashlib
from google.cloud import storage # Assuming storage client is available for image_exists check
from typing import Dict, Any

class SmartModelSelector:
    """
    PRO TIP: Not all story moments need the same model
    """
    def __init__(self):
        self.storage_client = storage.Client()
        self.bucket_name = os.getenv('CACHE_BUCKET', "storylives-image-cache")
        self.bucket = self.storage_client.bucket(self.bucket_name)

    def select_model(self, story_state: Dict[str, Any]) -> Optional[str]:
        """Choose cheapest model that meets needs"""
        
        if story_state.get('is_new_session', False):
            # First interaction - use pro for quality
            return "gemini-1.5-pro"
        
        if story_state.get('complexity') == 'simple':
            # Simple continuation - use flash (CHEAPER)
            return "gemini-1.5-flash"
        
        # Check if image generation is needed
        if story_state.get('needs_image', False):
            # Wait, we already have this image?
            if self.image_exists(story_state.get('image_prompt', '')):
                # Skip generation entirely!
                return None # Indicate no model needed if image is cached
        
        return "gemini-1.5-pro"
    
    def image_exists(self, prompt: str) -> bool:
        """Check cache before generating"""
        if not prompt:
            return False
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
        blob = self.bucket.blob(f"{prompt_hash}.png")
        return blob.exists()

import hashlib
import asyncio
from google.cloud import storage, aiplatform
from PIL import Image
import io
import time
import os

class ImageGenerator:
    def __init__(self):
        # Initialize Cloud Storage for caching
        self.storage_client = storage.Client()
        self.bucket_name = os.getenv('CACHE_BUCKET', "storylives-image-cache") # Use environment variable for bucket name
        self.bucket = self.storage_client.bucket(self.bucket_name)
        
        # Initialize Vertex AI
        aiplatform.init(project=os.getenv('GCP_PROJECT')) # Use environment variable for project ID
        self.imagen_model = aiplatform.ImageGenerationModel.from_pretrained(
            "imagegeneration @002"
        )
        
        # Cache stats for monitoring
        self.cache_hits = 0
        self.cache_misses = 0
    
    def _generate_prompt_hash(self, prompt: str) -> str:
        """Create unique hash from prompt for caching"""
        return hashlib.md5(prompt.encode()).hexdigest()
    
    async def get_or_generate_image(self, prompt: str) -> str:
        """
        CORE COST-SAVING FUNCTION
        Returns signed URL of image (either cached or newly generated)
        """
        prompt_hash = self._generate_prompt_hash(prompt)
        blob_name = f"{prompt_hash}.png"
        blob = self.bucket.blob(blob_name)
        
        # CHECK CACHE FIRST - This saves $$!
        if blob.exists():
            self.cache_hits += 1
            print(f"🎯 CACHE HIT! Saved ${self.calculate_savings()}")
            
            # Generate signed URL (expires in 1 hour)
            url = blob.generate_signed_url(
                version="v4",
                expiration=3600,
                method="GET"
            )
            return url
        
        # CACHE MISS - Generate new image
        self.cache_misses += 1
        print(f"🆕 Generating new image for: {prompt[:50]}...")
        
        # Call Imagen (this costs money)
        images = self.imagen_model.generate_images(
            prompt=prompt,
            number_of_images=1,
            aspect_ratio="1:1",
            safety_filter_level="block_some",
            person_generation="dont_allow"
        )
        
        # Save to Cloud Storage
        image = images[0]
        image_bytes = image._image_bytes  # Get raw bytes
        
        blob.upload_from_string(
            image_bytes,
            content_type="image/png"
        )
        
        # Add metadata for tracking
        blob.metadata = {
            "prompt": prompt,
            "generated_at": time.time(),
            "model": "imagen-2.0"
        }
        blob.patch()
        
        # Return signed URL
        url = blob.generate_signed_url(
            version="v4",
            expiration=3600,
            method="GET"
        )
        return url
    
    def calculate_savings(self):
        """Calculate money saved by caching"""
        # Imagen costs ~$0.02 per image
        cost_per_image = 0.02
        saved = self.cache_hits * cost_per_image
        return f"{saved:.2f}"
    
    def pre_generate_next_image(self, prompt: str):
        """
        PRO TIP: Start generating next image while child listens to narration
        This hides latency
        """
        asyncio.create_task(self.get_or_generate_image(prompt))

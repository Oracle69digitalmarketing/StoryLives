import google.generativeai as genai
import json
import os
from typing import Dict, Any

class StoryEngine:
    def __init__(self):
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        self.model = genai.GenerativeModel('gemini-1.5-pro')
        
        # CRITICAL: System prompt that defines personality
        self.system_prompt = """
        You are Lumi, a warm storyteller for children aged 5-9.
        
        CRITICAL RULES:
        1. Always respond in valid JSON format
        2. Keep narration to 2-3 sentences per chunk
        3. End each chunk with a question or choice
        4. Use simple, vivid language
        5. Never include scary elements
        
        Output format:
        {
            "narration": "text here",
            "image_prompt": "detailed description for illustration",
            "choices": ["choice a", "choice b"],
            "story_state": {
                "location": "current setting",
                "characters": ["list of characters"],
                "mood": "happy/excited/curious"
            }
        }
        """
    
    async def generate_chunk(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate next story chunk based on context"""
        
        # Build prompt with context
        prompt = f"""
        Previous story context: {json.dumps(context)}
        
        Continue the story naturally. If this is the start, introduce the main character
        and setting in an engaging way.
        """
        
        # Call Gemini
        response = self.model.generate_content(
            [self.system_prompt, prompt],
            generation_config={
                'temperature': 0.8,  # Creative but not random
                'max_output_tokens': 500,
            }
        )
        
        # Parse JSON response
        try:
            chunk = json.loads(response.text)
            return chunk
        except json.JSONDecodeError:
            # Fallback if Gemini returns bad JSON
            return self.fallback_chunk()
    
    def fallback_chunk(self):
        """Safe fallback if API fails"""
        return {
            "narration": "And then something wonderful happened...",
            "image_prompt": "A magical forest with glowing flowers",
            "choices": ["Go deeper", "Stay here"],
            "story_state": {"location": "forest", "characters": ["you"], "mood": "curious"}
        }

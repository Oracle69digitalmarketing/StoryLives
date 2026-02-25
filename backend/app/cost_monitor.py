from typing import Dict, Any

class CostMonitor:
    """
    REAL-TIME COST TRACKING
    """
    
    def __init__(self):
        self.daily_costs = {
            'gemini_pro': 0,
            'gemini_flash': 0,
            'imagen': 0,
            'tts': 0,
            'total': 0
        }
        
        # Free tier limits
        self.limits = {
            'gemini_pro_requests_per_minute': 60,  # requests per minute
            'imagen_images_per_day': 100,      # images per day
            'daily_budget_usd': 5   # $5/day hard limit
        }
    
    def track_request(self, service: str, cost: float):
        """Log every API call cost"""
        if service in self.daily_costs:
            self.daily_costs[service] += cost
        self.daily_costs['total'] += cost
        
        # Alert if approaching limits
        if self.daily_costs['total'] > self.limits['daily_budget_usd'] * 0.8:
            print("⚠️ WARNING: Approaching daily budget!")
            
        # Hard stop if over budget
        if self.daily_costs['total'] > self.limits['daily_budget_usd']:
            # In a real application, you might want to log this and notify admins
            print(f"🚫 ERROR: Daily budget exceeded - switching to fallback mode. Total: ${self.daily_costs['total']:.2f}")
            raise Exception("Daily budget exceeded - switching to fallback mode")
    
    def get_fallback_response(self) -> Dict[str, Any]:
        """When budget exceeded, use local generation"""
        print("💡 Providing fallback response due to budget exceeding.")
        return {
            'narration': self._local_story_template(),
            'image': self._default_image(),
            'choices': self._default_choices()
        }

    def _local_story_template(self) -> str:
        """A simple, locally generated story piece."""
        return "The story continues with a brave little hero finding a shimmering clue!"

    def _default_image(self) -> str:
        """A placeholder for a default image URL or base64."""
        # This could be a static image served from Cloud Storage
        return "https://example.com/default_story_image.png" 

    def _default_choices(self) -> list[str]:
        """Default choices for story progression."""
        return ["Go left", "Go right", "Ask for help"]

    def reset_daily_costs(self):
        """Resets daily costs, typically at the start of a new day."""
        for key in self.daily_costs:
            self.daily_costs[key] = 0

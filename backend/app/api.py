from .story_engine import StoryEngine
from .image_generator import ImageGenerator
from .session_manager import SessionManager
from .voice_handler import VoiceHandler
from .smart_model_selector import SmartModelSelector
from .batch_handler import BatchHandler
from .cost_monitor import CostMonitor

# Initialize all manager and engine classes
story_engine = StoryEngine()
image_generator = ImageGenerator()
session_manager = SessionManager()
voice_handler = VoiceHandler()
smart_model_selector = SmartModelSelector()
batch_handler = BatchHandler()
cost_monitor = CostMonitor()

# You can add other global variables or configurations here
# For example, a shared queue for background tasks
# background_tasks_queue = asyncio.Queue()

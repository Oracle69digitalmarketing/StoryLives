from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
import asyncio
import json
import os

from .api import (
    story_engine, 
    image_generator, 
    session_manager, 
    voice_handler,
    smart_model_selector,
    cost_monitor # Not directly used in main.py snippet but good to have access
)

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        # The original snippet had interruption_queue, but voice_handler now manages interruptions
        # self.interruption_queue = asyncio.Queue() 
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {websocket.client}")
    
    async def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"WebSocket disconnected: {websocket.client}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)
    
    async def handle_story_session(self, websocket: WebSocket, session_id: str):
        """Main loop for story interaction"""
        # Ensure session_id is valid, or generate a new one if not provided
        if not session_id:
            session_id = f"session_{os.urandom(8).hex()}"
            await websocket.send_json({"type": "session_id", "id": session_id})

        story_context = await session_manager.load_session(session_id)
        
        while True:
            if websocket.client_state == WebSocketState.DISCONNECTED:
                print(f"Client {websocket.client} disconnected, stopping session handling.")
                break
            
            try:
                # Generate next story chunk
                # Using smart_model_selector to decide which model to use (or if to skip image)
                model_to_use = smart_model_selector.select_model(story_context.get("story_state", {}))
                
                # Check if an image is already cached before generating a new chunk
                if model_to_use is None and story_context.get("story_state", {}).get("needs_image", False):
                    # Image already exists in cache, no need to generate
                    chunk = {"narration": "", "image_prompt": story_context["story_state"]["image_prompt"], "choices": []}
                else:
                    chunk = await story_engine.generate_chunk(story_context)
                
                # Update story context with the new chunk information
                story_context["story_history"].append(chunk)
                story_context["current_state"] = chunk.get("story_state", {})
                await session_manager.save_session(session_id, story_context)
                
                # Stream chunk character by character (for live feel)
                voice_handler.is_speaking = True
                interruption_task = asyncio.create_task(voice_handler.detect_interruption(websocket)) # Pass websocket for potential client-side audio stream
                
                for char in chunk['narration']:
                    await websocket.send_json({
                        'type': 'narration_char',
                        'char': char,
                        'chunk_id': "some_chunk_id" # Placeholder, story_engine snippet doesn't generate 'id'
                    })
                    await asyncio.sleep(0.02)  # Typing speed simulation
                    
                    if interruption_task.done() and interruption_task.result():
                        # Child wants to change something!
                        voice_handler.is_speaking = False
                        story_context = await voice_handler.handle_interruption(
                            websocket, 
                            story_context
                        )
                        # After handling interruption, the loop should restart with new context
                        break # Break out of char streaming and restart while True loop
                else: # This else block executes if the for loop completes without a break
                    voice_handler.is_speaking = False
                    interruption_task.cancel() # Cancel the interruption detection task if narration finishes
                    
                    # If no interruption, generate and send image
                    if chunk.get('image_prompt'):
                        # PRO TIP: Start generating next image while child listens to narration
                        # This hides latency
                        image_url = await image_generator.get_or_generate_image(chunk['image_prompt'])
                        await websocket.send_json({
                            'type': 'image',
                            'url': image_url,
                            'prompt': chunk['image_prompt']
                        })
                
                # Handle choices
                if chunk.get('choices'):
                    await websocket.send_json({
                        'type': 'choices',
                        'choices': chunk['choices']
                    })
                
                # Wait for user input (choice or voice)
                user_input = await websocket.receive_json() # This needs to be more sophisticated, handling different types of input
                if user_input.get("type") == "choice":
                    story_context["last_user_choice"] = user_input["value"]
                elif user_input.get("type") == "voice_input":
                    story_context["last_user_voice"] = user_input["value"]
                # For now, just continue the loop with updated context
                
            except WebSocketDisconnect:
                print(f"WebSocket {websocket.client} disconnected during session handling.")
                break
            except Exception as e:
                print(f"Error in story session: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})
                # Depending on error, might want to break or try to recover
                break # For now, break on error

# Initialize ConnectionManager
manager = ConnectionManager()

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket)
    try:
        await manager.handle_story_session(websocket, session_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"Unhandled exception in websocket_endpoint: {e}")
        await websocket.close(code=1011) # Internal Error
    finally:
        if websocket in manager.active_connections:
            manager.disconnect(websocket)

@app.get("/")
async def read_root():
    return {"message": "Welcome to StoryLives Backend"}

# Helper functions to delegate to api.py components (as called in ConnectionManager.handle_story_session)
async def load_session(session_id: str):
    return await session_manager.load_session(session_id)

async def generate_story_chunk(context: dict):
    return await story_engine.generate_chunk(context)

async def check_interruption(websocket: WebSocket):
    # This will be handled by voice_handler.detect_interruption directly within handle_story_session loop
    pass

async def get_interruption_input(websocket: WebSocket):
    # This will be handled by voice_handler.listen_for_input within handle_interruption
    pass

async def incorporate_direction(story_context: dict, new_direction: str):
    # This will be handled by voice_handler.incorporate_input within handle_interruption
    return await voice_handler.incorporate_input(story_context, new_direction)

async def generate_or_get_image(image_prompt: str):
    return await image_generator.get_or_generate_image(image_prompt)

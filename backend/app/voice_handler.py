import asyncio
from typing import Optional
import numpy as np
import os

# Import Google Cloud client libraries
import google.cloud.texttospeech as tts
import google.cloud.speech as speech

class VoiceHandler: # Renamed from LiveAPIHandler to VoiceHandler for consistency with project structure
    def __init__(self):
        self.is_speaking = False
        self.interruption_threshold = 0.5  # Audio level threshold

        # Initialize Google Cloud Text-to-Speech client
        self.tts_client = tts.TextToSpeechClient()
        # Configure TTS voice
        self.tts_voice = tts.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Standard-C", # Or another suitable voice for children
            ssml_gender=tts.SsmlVoiceGender.FEMALE, # Lumi is a warm AI storyteller
        )
        self.tts_audio_config = tts.AudioConfig(
            audio_encoding=tts.AudioEncoding.MP3 # Or LINEAR16 if streaming to client
        )

        # Initialize Google Cloud Speech-to-Text client
        self.stt_client = speech.SpeechClient()
        # STT configuration for basic recognition
        self.stt_config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16, # Assuming LINEAR16 from client
            sample_rate_hertz=16000, # Common sample rate
            language_code="en-US",
            model="default", # Or "command_and_search" for short utterances, "telephony"
        )
        self.stt_streaming_config = speech.StreamingRecognitionConfig(
            config=self.stt_config,
            interim_results=False, # Only send final results
        )
        
    async def synthesize_speech(self, text: str) -> bytes:
        """Converts text to speech audio bytes using Google Cloud TTS."""
        synthesis_input = tts.SynthesisInput(text=text)
        response = self.tts_client.synthesize_speech(
            input=synthesis_input,
            voice=self.tts_voice,
            audio_config=self.tts_audio_config,
        )
        return response.audio_content

    async def detect_interruption(self, websocket) -> bool:
        """
        Detects if a child speaks while Lumi is narrating.
        This is a placeholder for actual real-time audio analysis or client-side detection.
        For now, it simulates by checking for a specific message from the client.
        In a real scenario, the client would stream audio and this server would process it.
        """
        # In a real scenario, this would involve receiving real-time audio chunks from the client
        # and performing voice activity detection (VAD) or similar analysis.
        # For this simulation, we'll assume the client sends a specific "interrupt" message.
        try:
            # We can't actually 'listen' to the audio_stream passed if it's just a dummy.
            # Instead, we'll try to peek into the websocket for an interruption signal.
            # This is highly simplified and assumes the client sends a JSON message for interruption.
            message = await asyncio.wait_for(websocket.receive_json(), timeout=0.1) # Short timeout
            if message.get("type") == "interruption":
                print("🚨 Interruption detected!")
                return True
        except asyncio.TimeoutError:
            pass # No interruption message within the timeout
        except Exception as e:
            print(f"Error detecting interruption: {e}")
            pass
        return False
    
    async def handle_interruption(self, websocket, story_context):
        """Pause narration and get child's input"""
        
        # Send pause signal to frontend
        await websocket.send_json({
            'type': 'pause',
            'message': 'Oh? You want to change something?'
        })
        
        # Synthesize and send the interruption message to the client
        interruption_audio = await self.synthesize_speech('Oh? You want to change something?')
        await websocket.send_bytes(interruption_audio) # Assuming client can play audio bytes
        
        # Stop TTS
        self.is_speaking = False
        
        # Listen for child's input (5 second timeout)
        try:
            # For this example, we assume the client streams LINEAR16 audio data.
            # The client should send a 'start_speaking' signal, then audio chunks, then 'end_speaking'.
            # The 'listen_for_input' will need to accumulate and process this.
            child_input = await asyncio.wait_for(
                self.listen_for_input(websocket),
                timeout=5.0
            )
            
            # Incorporate into story
            new_context = await self.incorporate_input(
                story_context,
                child_input
            )
            
            # Resume narration feedback
            resume_text = "Great idea! Let's do that!"
            resume_audio = await self.synthesize_speech(resume_text)
            await websocket.send_bytes(resume_audio) # Send audio for resume message
            await websocket.send_json({
                'type': 'resume',
                'message': resume_text
            })
            
            return new_context
            
        except asyncio.TimeoutError:
            # Child didn't say anything, resume
            timeout_text = "Hmm, I didn't hear anything. Let's continue the story!"
            timeout_audio = await self.synthesize_speech(timeout_text)
            await websocket.send_bytes(timeout_audio)
            await websocket.send_json({
                'type': 'resume',
                'message': timeout_text
            })
            return story_context

    async def listen_for_input(self, websocket) -> str:
        """
        Listens for child's audio input streamed over WebSocket and converts to text using Google Cloud STT.
        This is a simplified version. A full implementation would handle streaming audio chunks.
        Assumes client sends audio data in chunks of LINEAR16 encoding.
        """
        print("Listening for child's input...")
        audio_chunks = []
        # In a real streaming scenario, you'd have a generator for requests_iterator
        # For simplicity, we'll assume the client sends all audio in a few messages
        # marked by 'audio_chunk' type and then a 'end_audio' signal.

        # We'll collect audio until an 'end_audio' message or timeout.
        try:
            while True:
                message = await asyncio.wait_for(websocket.receive(), timeout=1.0) # Listen for a chunk or control message
                # websocket.receive() returns a dictionary with 'type', 'text', 'bytes' keys.
                if message.get("type") == "audio_chunk" and message.get("bytes"):
                    audio_chunks.append(message["bytes"])
                elif message.get("type") == "end_audio":
                    break
                elif message.get("type") == "user_input" and message.get("text"):
                    # Fallback for text input if audio streaming isn't fully implemented
                    return message["text"]
        except asyncio.TimeoutError:
            print("No more audio chunks received within timeout.")
        except Exception as e:
            print(f"Error receiving audio chunks: {e}")

        if not audio_chunks:
            print("No audio data received.")
            return ""

        # Concatenate all audio chunks
        full_audio_content = b"".join(audio_chunks)
        
        # Create an Audio object from the collected content
        audio = speech.RecognitionAudio(content=full_audio_content)

        # Perform synchronous speech recognition (for simplicity here; streaming would be ideal for live)
        print("Sending audio to Google STT...")
        try:
            response = self.stt_client.recognize(config=self.stt_config, audio=audio)
            transcript = ""
            for result in response.results:
                if result.alternatives:
                    transcript += result.alternatives[0].transcript + " "
            print(f"STT Transcript: {transcript.strip()}")
            return transcript.strip()
        except Exception as e:
            print(f"Google STT error: {e}")
            return ""


    async def incorporate_input(self, story_context: dict, child_input: str) -> dict:
        """Mocks incorporating child's input into the story context."""
        print(f"Incorporating child input: {child_input}")
        story_context["last_child_input"] = child_input
        # In a real scenario, this would likely involve calling the StoryEngine
        # with the updated context and child_input to generate the next story part.
        return story_context

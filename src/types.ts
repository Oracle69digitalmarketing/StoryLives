export interface StoryState {
  location: string;
  characters: string[];
  mood: string;
}

export interface StoryChunk {
  id: string;
  narration: string;
  image_prompt: string;
  choices: string[];
  story_state: StoryState;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  chunk?: StoryChunk;
}

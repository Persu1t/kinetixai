import { RealtimeSession } from "@openai/agents-realtime";
import { createTrainer } from "./agnt";
import axios from "axios";

interface AISession {
  on(event: 'response.created' | 'response.delta' | 'response.completed', handler: () => void): void;
  close(): void;
}

export const createAISession = async (getRepHistroy: () => any[]): Promise<AISession> => {
  const response = await axios.get('/api');
  const tempkey = response.data.tempApiKey;
  const agent = createTrainer(getRepHistroy);
  const session = new RealtimeSession(agent, {
    model: "gpt-4o-realtime-preview",
  })
  await session.connect({ apiKey: tempkey });
  return session;
}
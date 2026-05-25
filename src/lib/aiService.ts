import { supabase } from "@/integrations/supabase/client";

export interface AiConfig {
  provider: "gemini" | "openai" | "anthropic" | "custom";
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export function getAiConfig(): AiConfig {
  const provider = (localStorage.getItem("brand_flow_ai_provider") as any) || "gemini";
  const model = localStorage.getItem("brand_flow_ai_model") || "gemini-1.5-flash";
  const apiKey = localStorage.getItem("brand_flow_ai_key") || "";
  const baseUrl = localStorage.getItem("brand_flow_ai_custom_url") || "";

  return { provider, model, apiKey, baseUrl };
}

export function saveAiConfig(config: AiConfig) {
  localStorage.setItem("brand_flow_ai_provider", config.provider);
  localStorage.setItem("brand_flow_ai_model", config.model);
  localStorage.setItem("brand_flow_ai_key", config.apiKey);
  if (config.baseUrl) {
    localStorage.setItem("brand_flow_ai_custom_url", config.baseUrl);
  } else {
    localStorage.removeItem("brand_flow_ai_custom_url");
  }
}

async function callAiProxy(prompt: string): Promise<string> {
  const config = getAiConfig();
  
  // Call the Supabase edge function
  const { data, error } = await supabase.functions.invoke("ai-proxy", {
    body: {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      prompt,
      baseUrl: config.baseUrl,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to generate AI content");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.text || "";
}

/**
 * Generate viral social media hooks based on niche and topic
 */
export async function generateAiHooks(niche: string, topic: string): Promise<string> {
  const prompt = `You are a viral social media strategist. Generate 3 highly engaging, scroll-stopping hooks for a video about "${topic}" in the "${niche}" niche. 
For each hook, structure it like this:
1. Hook Type (e.g. Negative, Curated, Bold Statement, Curious)
2. Hook Text (Under 100 characters, punchy and emotional)
3. Explanation (Why this hook works)

Keep the tone modern, premium, and geared towards Instagram Reels, TikTok, and YouTube Shorts. Do not include markdown formatting other than bold titles.`;

  return await callAiProxy(prompt);
}

/**
 * Generate a complete 30-60 second video script based on a content pillar and topic
 */
export async function generateAiScript(pillar: string, topic: string, platform: string): Promise<string> {
  const prompt = `You are a premium content writer. Write a complete 30-60 second video script for a Reel/Short about "${topic}" based on the content pillar "${pillar}" tailored for "${platform}".
Format the script with clear sections:
- HOOK (First 3 seconds, high energy)
- BODY (3-4 value-packed bullet points, concise and pacing-oriented)
- CTA (Call to action, encouraging saving/following)

Provide visual cues in brackets [like this] for the creator (e.g. [Visual: pointing up], [Text on screen: "Stop doing X"]). Keep the script spoken words highly natural and conversational.`;

  return await callAiProxy(prompt);
}

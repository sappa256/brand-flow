import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENCRYPTION_SECRET = Deno.env.get("ENCRYPTION_KEY") || "brand_flow_default_secure_vault_key_32";

// AES-GCM Encryption helpers
async function encryptText(text: string): Promise<string> {
  const keyBuf = new TextEncoder().encode(ENCRYPTION_SECRET.padEnd(32, '0').slice(0, 32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptText(encryptedBase64: string): Promise<string> {
  try {
    const keyBuf = new TextEncoder().encode(ENCRYPTION_SECRET.padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuf,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const combined = new Uint8Array(
      atob(encryptedBase64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    throw new Error("Failed to decrypt custom API key. Please check your encryption setup.");
  }
}

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const urlObj = new URL(req.url);
    const authHeader = req.headers.get("authorization") || "";
    
    // Authenticate user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();

    // 1. Encryption endpoint helper
    if (urlObj.pathname.endsWith("/encrypt")) {
      const { text } = payload;
      if (!text) throw new Error("Missing text to encrypt");
      const encrypted = await encryptText(text);
      return new Response(JSON.stringify({ encrypted }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Gateway execution path
    const { provider, model, prompt, tenant_id, stream } = payload;

    if (!provider || !model || !prompt || !tenant_id) {
      throw new Error("Missing required parameters: provider, model, prompt, tenant_id");
    }

    // Check user membership and permissions
    const { data: isMember } = await supabase.rpc("has_permission", {
      user_id: user.id,
      tenant_id: tenant_id,
      perm_name: "edit_reels"
    });

    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden: You are not authorized to use AI in this workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate Limiting Check (max 60 requests per minute per tenant)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: requestCount } = await supabase
      .from("ai_requests_history")
      .select("id", { count: "exact" })
      .eq("tenant_id", tenant_id)
      .gt("created_at", oneMinuteAgo);

    if (requestCount !== null && requestCount >= 60) {
      // Log rate limit trigger
      await supabase.from("ai_requests_history").insert({
        tenant_id,
        user_id: user.id,
        provider,
        model,
        status: "error",
        error_message: "Rate limit exceeded (60 requests per minute)",
      });
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a minute before sending another request." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple Content Moderation Check
    const flaggedWords = ["hack", "exploit", "bypass RLS", "malware", "steal credentials"];
    const isFlagged = flaggedWords.some((word) => prompt.toLowerCase().includes(word));
    if (isFlagged) {
      await supabase.from("ai_requests_history").insert({
        tenant_id,
        user_id: user.id,
        provider,
        model,
        status: "moderated",
        error_message: "Flagged prompt content violation",
      });
      return new Response(JSON.stringify({ error: "Content moderation alert: Your prompt contains restricted terms." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant details and custom API keys
    const { data: orgData, error: orgErr } = await supabase
      .from("organizations")
      .select("encrypted_api_keys, billing_settings")
      .eq("id", tenant_id)
      .single();

    if (orgErr || !orgData) {
      throw new Error("Failed to load workspace settings");
    }

    let customKeys: Record<string, string> = {};
    if (orgData.encrypted_api_keys) {
      const decryptedJson = await decryptText(orgData.encrypted_api_keys);
      customKeys = JSON.parse(decryptedJson);
    }

    // Call API helper
    const executeAiCall = async (prov: string, mdl: string): Promise<{ text: string; promptTokens: number; completionTokens: number }> => {
      let apiKey = customKeys[prov];
      if (!apiKey) {
        // Fallback to system keys
        if (prov === "gemini") apiKey = Deno.env.get("GEMINI_API_KEY") || "";
        else if (prov === "openai") apiKey = Deno.env.get("OPENAI_API_KEY") || "";
        else if (prov === "anthropic") apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
      }

      if (!apiKey && prov !== "custom") {
        throw new Error(`API key not configured for provider: ${prov}`);
      }

      if (prov === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Estimate token usage (roughly 1 token = 4 characters)
        const promptTokens = Math.ceil(prompt.length / 4);
        const completionTokens = Math.ceil(text.length / 4);
        return { text, promptTokens, completionTokens };

      } else if (prov === "openai") {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: mdl,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        return {
          text,
          promptTokens: data.usage?.prompt_tokens || Math.ceil(prompt.length / 4),
          completionTokens: data.usage?.completion_tokens || Math.ceil(text.length / 4),
        };

      } else if (prov === "anthropic") {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: mdl,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2048,
          }),
        });

        if (!response.ok) throw new Error(`Anthropic API error: ${response.statusText}`);
        const data = await response.json();
        const text = data.content?.[0]?.text || "";
        return {
          text,
          promptTokens: data.usage?.input_tokens || Math.ceil(prompt.length / 4),
          completionTokens: data.usage?.output_tokens || Math.ceil(text.length / 4),
        };
      } else if (prov === "custom") {
        // Custom models, e.g. local Ollama
        const customUrl = payload.customUrl || "http://localhost:11434/v1/chat/completions";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

        const response = await fetch(customUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: mdl,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) throw new Error(`Custom model error: ${response.statusText}`);
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        return {
          text,
          promptTokens: Math.ceil(prompt.length / 4),
          completionTokens: Math.ceil(text.length / 4),
        };
      } else {
        throw new Error(`Unsupported provider: ${prov}`);
      }
    };

    // Execute with Retry/Fallback
    let aiResult;
    let usedProvider = provider;
    let usedModel = model;
    try {
      aiResult = await executeAiCall(provider, model);
    } catch (primaryErr) {
      console.warn(`Primary provider ${provider} failed, triggering fallback to Gemini...`, primaryErr);
      try {
        usedProvider = "gemini";
        usedModel = "gemini-1.5-flash";
        aiResult = await executeAiCall(usedProvider, usedModel);
      } catch (fallbackErr) {
        throw new Error(`AI generation failed: ${primaryErr.message}. Fallback also failed: ${fallbackErr.message}`);
      }
    }

    // Estimate Cost (USD)
    // OpenAI GPT-4o: $5.00/1M input, $15.00/1M output
    // Anthropic Claude 3.5 Sonnet: $3.00/1M input, $15.00/1M output
    // Gemini 1.5 Flash: $0.075/1M input, $0.30/1M output
    let estimatedCost = 0.0;
    if (usedProvider === "openai") {
      estimatedCost = (aiResult.promptTokens * 5.0) / 1000000 + (aiResult.completionTokens * 15.0) / 1000000;
    } else if (usedProvider === "anthropic") {
      estimatedCost = (aiResult.promptTokens * 3.0) / 1000000 + (aiResult.completionTokens * 15.0) / 1000000;
    } else if (usedProvider === "gemini") {
      estimatedCost = (aiResult.promptTokens * 0.075) / 1000000 + (aiResult.completionTokens * 0.30) / 1000000;
    }

    // Log Successful AI usage
    await supabase.from("ai_requests_history").insert({
      tenant_id,
      user_id: user.id,
      provider: usedProvider,
      model: usedModel,
      prompt_tokens: aiResult.promptTokens,
      completion_tokens: aiResult.completionTokens,
      cost: parseFloat(estimatedCost.toFixed(6)),
      status: "success",
    });

    return new Response(JSON.stringify({ text: aiResult.text, fallbackUsed: usedProvider !== provider }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

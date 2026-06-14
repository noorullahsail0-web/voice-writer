/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Polyfill Promise.try for older Node environments lacking native support
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function<T>(callback: (...args: any[]) => T | PromiseLike<T>, ...args: any[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(callback(...args));
      } catch (err) {
        reject(err);
      }
    });
  };
}

const app = express();
const PORT = 3000;

// Increase request limit for base64 files with safe serverless bypass if pre-parsed by Vercel
app.use((req, res, next) => {
  if (req.body !== undefined) {
    next();
  } else {
    express.json({ limit: "100mb" })(req, res, next);
  }
});
app.use((req, res, next) => {
  if (req.body !== undefined) {
    next();
  } else {
    express.urlencoded({ limit: "100mb", extended: true })(req, res, next);
  }
});

// Lazy initializer for Gemini client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    if (process.env.VERCEL) {
      throw new Error(
        "ورسل پر جیمنی کی (GEMINI_API_KEY) غائب ہے۔ براہ کرم اپنے Vercel Dashboard میں جا کر Project Settings -> Environment Variables میں GEMINI_API_KEY کو اپنے جیمنی کی کے ساتھ سیٹ کریں اور دوبارہ ڈپلائے کریں۔"
      );
    }
    throw new Error(
      "حسبِ منشا کام کرنے کے لئے GEMINI_API_KEY فراہم کی جانی چاہیے۔ براہ کرم AI Studio کے دائیں کونے میں موجود 'Secrets' مینو میں جا کر اپنی کی فراہم کریں۔"
    );
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Safe wrapper around generateContent that adds retries with exponential backoff
 * and falls back to other high-availability models if a 503 (or transient load error) occurs.
 */
async function generateContentWithRetryAndFallback(params: {
  contents: any;
  config?: any;
  primaryModel?: string;
}) {
  const ai = getGeminiClient();
  const isVercel = !!process.env.VERCEL;
  const primary = params.primaryModel || "gemini-3.5-flash";
  
  // High-availability alternate fallback models
  const modelsToTry = [primary, "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];
  
  let lastError: any = null;
  
  for (const model of modelsToTry) {
    // 2 attempts per model with short delays preserves execution budget and adds ultimate failure protection
    let retries = 2; 
    let delay = isVercel ? 500 : 1000; 
    
    while (retries > 0) {
      try {
        console.log(`[Gemini API] Requesting ${model} (Attempts remaining for this model: ${retries})...`);
        
        // Safely adjust config if model is not a Gemini 3.5 thinking model
        let modelConfig = params.config ? { ...params.config } : {};
        if (!model.startsWith("gemini-3.5") && modelConfig.thinkingConfig) {
          // Non-3.5 models do not support custom thinkingLevel
          delete modelConfig.thinkingConfig;
        }
        
        const response = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: modelConfig,
        });
        
        // Success! Return the response
        console.log(`[Gemini API] Successfully received response from ${model}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errMsg = String(error.message || "").toLowerCase();
        let errJson = errMsg;
        try {
          errJson = JSON.stringify({
            message: error.message,
            status: error.status,
            code: error.code,
            details: error.details,
          });
        } catch (_) {}
        errJson = errJson.toLowerCase();
        
        // Check if error is a quota/rate-limit error (429) or resource exhaustion
        const isQuotaExceeded =
          errMsg.includes("429") ||
          errMsg.includes("limit") ||
          errMsg.includes("quota") ||
          errMsg.includes("exhausted") ||
          errJson.includes("429") ||
          errJson.includes("limit") ||
          errJson.includes("quota") ||
          errJson.includes("exhausted") ||
          error.status === 429 ||
          error.code === 429;

        if (isQuotaExceeded) {
          console.log(`[Status] Model ${model} is currently busy/rate-limited. Seamlessly transitioning to fallback...`);
          break; // Break retry loop on this model immediately and move to the next model!
        }
        
        // Check if error is a transient server-side spike (503, unavailable, overloaded)
        const isTransientServerSpike = 
          errMsg.includes("503") || 
          errMsg.includes("unavailable") || 
          errMsg.includes("high demand") || 
          errMsg.includes("overloaded") ||
          errMsg.includes("temp") ||
          errMsg.includes("spike") ||
          errJson.includes("503") || 
          errJson.includes("unavailable") || 
          errJson.includes("high demand") || 
          errJson.includes("overloaded") ||
          errJson.includes("temp") ||
          errJson.includes("spike") ||
          error.status === 503 ||
          error.code === 503;
          
        if (!isTransientServerSpike) {
          // If it's a permanent error or validation error, don't retry on this model but try the next fallback model.
          console.log(`[Status] Model ${model} returned handled message. Moving to alternate model.`);
          break;
        }
        
        retries--;
        if (retries > 0 && delay > 0) {
          console.log(`[Status] Model ${model} returned a temporary busy state. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5; // gentle backoff
        }
      }
    }
  }
  
  // If we reach here, both the primary and all fallback models have been exhausted.
  throw lastError || new Error("مطلوبہ ماڈل پر ابھی رش زیادہ ہے، براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔");
}

/**
 * Safe wrapper around generateContentStream that adds retries and model fallback
 * to support immediate chunked response flushing (ideal for serverless timeout mitigation).
 */
async function generateContentStreamWithRetryAndFallback(params: {
  contents: any;
  config?: any;
  primaryModel?: string;
}) {
  const ai = getGeminiClient();
  const isVercel = !!process.env.VERCEL;
  const primary = params.primaryModel || "gemini-3.5-flash";
  
  // High-availability alternate fallback models
  const modelsToTry = [primary, "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];
  
  let lastError: any = null;
  
  for (const model of modelsToTry) {
    let retries = 2; 
    let delay = isVercel ? 500 : 1000; 
    
    while (retries > 0) {
      try {
        console.log(`[Gemini API Stream] Requesting stream from ${model} (Attempts remaining for this model: ${retries})...`);
        
        // Safely adjust config if model is not a Gemini 3.5 thinking model
        let modelConfig = params.config ? { ...params.config } : {};
        if (!model.startsWith("gemini-3.5") && modelConfig.thinkingConfig) {
          delete modelConfig.thinkingConfig;
        }
        
        const responseStream = await ai.models.generateContentStream({
          model: model,
          contents: params.contents,
          config: modelConfig,
        });
        
        console.log(`[Gemini API Stream] Successfully opened stream from ${model}`);
        return responseStream;
      } catch (error: any) {
        lastError = error;
        const errMsg = String(error.message || "").toLowerCase();
        let errJson = errMsg;
        try {
          errJson = JSON.stringify({
            message: error.message,
            status: error.status,
            code: error.code,
            details: error.details,
          });
        } catch (_) {}
        errJson = errJson.toLowerCase();
        
        const isQuotaExceeded =
          errMsg.includes("429") ||
          errMsg.includes("limit") ||
          errMsg.includes("quota") ||
          errMsg.includes("exhausted") ||
          errJson.includes("429") ||
          errJson.includes("limit") ||
          errJson.includes("quota") ||
          errJson.includes("exhausted") ||
          error.status === 429 ||
          error.code === 429;

        if (isQuotaExceeded) {
          console.log(`[Status] Model ${model} is currently busy/rate-limited. Seamlessly transitioning to fallback on stream...`);
          break;
        }
        
        const isTransientServerSpike = 
          errMsg.includes("503") || 
          errMsg.includes("unavailable") || 
          errMsg.includes("high demand") || 
          errMsg.includes("overloaded") ||
          errMsg.includes("temp") ||
          errMsg.includes("spike") ||
          errJson.includes("503") || 
          errJson.includes("unavailable") || 
          errJson.includes("high demand") || 
          errJson.includes("overloaded") ||
          errJson.includes("temp") ||
          errJson.includes("spike") ||
          error.status === 503 ||
          error.code === 503;
          
        if (!isTransientServerSpike) {
          console.log(`[Status] Model ${model} stream returned handled message. Moving to alternate model.`);
          break;
        }
        
        retries--;
        if (retries > 0 && delay > 0) {
          console.log(`[Status] Model ${model} stream returned a temporary busy state. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }
  }
  
  throw lastError || new Error("مطلوبہ ماڈل پر ابھی رش زیادہ ہے، اور اسٹریم شروع نہیں کی جا سکی۔");
}

// REST API routes must be declared FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * High-fidelity OCR page extraction endpoint.
 * Streams real-time tokens to the client to keep connections active and prevent timeouts.
 */
app.post("/api/ocr-page", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: "براہ کرم صفحہ کی تصویر فراہم کریں۔" });
    }

    const cleanMime = mimeType || "image/png";

    const prompt = 
      "You are an expert Urdu, Arabic, and English typesetting, OCR, and composing specialist with ultimate precision.\n" +
      "Your task is to transcribe EVERY SINGLE word of any language from this page image (scanned page image) with 100% complete, uncompromised fidelity. No skipping, no omission, and no summarization of any section are allowed.\n" +
      "Follow these rules strictly:\n" +
      "1. Transcribe EVERY word of the actual body text completely. NEVER leave out any sentences, paragraphs, dialogue lines, side notes, names, or individual words. If a word or phrase is slightly blurry, faded, or contains scan imperfections, do NOT omit it — transcribe it to the absolute best of your ability using contextual clues to resolve any broken characters.\n" +
      "2. Extract and preserve ALL text in its native script exactly (transcribe Urdu in elegant Urdu script, Arabic in Arabic script, English in Latin script).\n" +
      "3. Preserve all structural formatting including structural paragraphs, exact lines, list markers, dialogue dashes, indentation, and classical poetry layouts (e.g., shair / misra structures / hemistiches).\n" +
      "4. ONLY strip out or ignore decorative border lines, independent page number numbers (if they are clearly page numbers separate from headers), and explicitly external advertisement watermarks (URLs/phone numbers printed on margins). If a line at the top or bottom is a heading, sub-heading, chapter name, or structural part of the narrative content, you MUST transcribe it fully. Do not misclassify actual body text as borders or headers.\n" +
      "5. Seamlessly correct word boundary irregularities (such as fix improper spacing, join incorrectly fragmented characters, connect broken letters like 'ہو گیا' or 'کر دیا' instead of typing them as separate unreadable chunks) to produce a ready-to-publish, flawless, continuous text sheet.\n" +
      "6. Absolute literal precision: Do not summarize or paraphrase. Do NOT add any introductions, explanations, translators notes, or markdown backticks enclosing the output. Output ONLY the raw, complete, extracted document body text.";

    const imagePart = {
      inlineData: {
        mimeType: cleanMime,
        data: image,
      },
    };

    // Send headers for Event Stream chunked transfer immediately (prevents Vercel 10s timeout instantly)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Prevent Vercel network buffering on proxy layer
    (res as any).flushHeaders?.();

    // Pulse warming keep-alive packet to prevent cold start gateway serverless disconnects
    res.write(`data: ${JSON.stringify({ status: "warming" })}\n\n`);
    (res as any).flush?.();

    console.log("[OCR Request] Opening Gemini OCR Stream...");
    const responseStream = await generateContentStreamWithRetryAndFallback({
      primaryModel: "gemini-2.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {},
    });

    for await (const chunk of responseStream) {
      const chunkText = chunk.text || "";
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        (res as any).flush?.();
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("OCR API error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message || "او سی آر کے دوران خرابی پیش آئی۔" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || "او سی آر کے دوران خرابی پیش آئی۔" });
    }
  }
});

/**
 * Text refiner (spelling correction, diacritics insertion, translation, summarization)
 * Uses high-fidelity streaming block for absolute stability on Vercel deployments.
 */
app.post("/api/refine-text", async (req, res) => {
  try {
    const { text, mode } = req.body;
    if (!text) {
      return res.status(400).json({ error: "براہ کرم ترمیم کرنے کے لئے عبارت فراہم کریں۔" });
    }

    let prompt = "";

    switch (mode) {
      case "imla":
        prompt = 
          "You are a professional Urdu and Arabic spellchecker and proofreader.\n" +
          "Correct all spelling, typo, spacing glitches, and punctuation mistakes in the following text.\n" +
          "Make sure Urdu word boundaries (like joining of 'ہوگیا' to 'ہو گیا' or splitting inappropriately joined terms) are perfectly resolved for print composing. Keep style original, ONLY fix spelling structure, errors, and formatting flow. Return only the corrected text without explanations:";
        break;
      case "tashkeel":
        prompt = 
          "You are an Arabic and Urdu grammar expert. Modify the following text by inserting accurate diacritic marks (حركات / اعراب / زیر زبر پیش) on appropriate letters to guide perfect pronunciation easily. Keep text identical; only enrich with vowel marks. Return only the revised text with no extras:";
        break;
      case "khulasa":
        prompt = 
          "Summarize the following text clearly in elegant Urdu prose. Condense key narratives or themes, but keep standard names, critical notes, or dialogues unchanged. return only the Urdu summary:";
        break;
      case "urdu_translate":
        prompt = 
          "Translate the following text into eloquent Urdu suitable for literary digest publishing. Preserve emotional tone and style. Return only the translated text:";
        break;
      case "english_translate":
        prompt = 
          "Translate the following Urdu/Arabic text into clear, elegant English prose. return only the translated text:";
        break;
      default:
        prompt = "Review and polish the following text, improving readability and typesetting. return only the polished text:";
    }

    // Send headers for Event Stream chunked transfer immediately (prevents Vercel 10s timeout instantly)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Prevent Vercel network buffering on proxy layer
    (res as any).flushHeaders?.();

    // Pulse warming keep-alive packet to prevent cold start gateway serverless disconnects
    res.write(`data: ${JSON.stringify({ status: "warming" })}\n\n`);
    (res as any).flush?.();

    console.log(`[Refinement Request] Opening Text Refinement Stream for mode: ${mode}...`);
    const responseStream = await generateContentStreamWithRetryAndFallback({
      primaryModel: "gemini-3.5-flash",
      contents: [prompt, text],
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    for await (const chunk of responseStream) {
      const chunkText = chunk.text || "";
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        (res as any).flush?.();
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Refining API error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message || "ترمیم کے دوران خرابی پیش آئی۔" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || "ترمیم کے دوران خرابی پیش آئی۔" });
    }
  }
});

/**
 * Speech recognition transcriber endpoint.
 * Acts as high-accuracy processing for user voice recordings.
 */
app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "ریکارڈنگ آڈیو حاصل نہیں ہوئی۔" });
    }

    const ai = getGeminiClient();
    
    // Normalize and sanitize MIME type for absolute Gemini compatibility
    let cleanMime = "audio/webm";
    if (mimeType) {
      const baseMime = mimeType.split(";")[0].trim().toLowerCase();
      if (baseMime.includes("webm")) {
        cleanMime = "audio/webm";
      } else if (baseMime.includes("mp4") || baseMime.includes("m4a") || baseMime.includes("aac")) {
        cleanMime = "audio/mp4";
      } else if (baseMime.includes("ogg")) {
        cleanMime = "audio/ogg";
      } else if (baseMime.includes("wav") || baseMime.includes("wave") || baseMime.includes("x-wav")) {
        cleanMime = "audio/wav";
      } else if (baseMime.includes("mp3") || baseMime.includes("mpeg")) {
        cleanMime = "audio/mp3";
      } else if (baseMime.includes("flac")) {
        cleanMime = "audio/flac";
      } else if (baseMime.includes("audio/")) {
        cleanMime = baseMime;
      }
    }

    const prompt = 
      "You are a professional audio transcriber. Transcribe this audio recording with maximum precision.\n" +
      "The audio is likely spoken in Urdu (اردو), Arabic (عربی), or English, or a fluid blend of these.\n" +
      "Your instructions:\n" +
      "1. Listen carefully and output the transcription in the correct native scripts. Urdu speech -> Urdu script, Arabic -> Arabic script with exact words, English -> standard Latin script.\n" +
      "2. If the audio is completely silent, contains only static/rustle/background noise, or has no decipherable speech, respond with absolutely nothing (completely empty). Do NOT explain, and do NOT request files.\n" +
      "3. Correct speech slip-ups, heavy breathing, hesitation filler words (like 'um', 'uh', 'اہ', 'وں') silences, or repetitive words silently.\n" +
      "4. Only output the actual spoken words, typeset nicely. Do NOT write any introduction, commentary or meta labels.";

    const audioPart = {
      inlineData: {
        mimeType: cleanMime,
        data: audio,
      },
    };

    const response = await generateContentWithRetryAndFallback({
      primaryModel: "gemini-3.5-flash",
      contents: { parts: [audioPart, { text: prompt }] },
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Transcription API error:", error);
    res.status(500).json({ error: error.message || "آڈیو آؤٹ پٹ تیار کرنے میں ناکامی۔" });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.VERCEL) {
    console.log("[Urdu VoiceWriter Backend] Running in Vercel. Dynamic loading and port listening bypassed.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // Hide 'vite' import string from static bundlers to avoid runtime resolution crash on production pruning
    const viteModuleName = "vite";
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Urdu VoiceWriter Backend] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;

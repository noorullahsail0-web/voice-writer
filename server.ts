/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase request limit for base64 files
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

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
  const primary = params.primaryModel || "gemini-3.5-flash";
  
  // High-availability alternate fallback models
  const modelsToTry = [
    primary,
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
  ];
  
  let lastError: any = null;
  
  for (const model of modelsToTry) {
    let retries = 2; // 2 attempts per model (initial + 1 retry) to cascade to healthy fallback models faster
    let delay = 1000; // start with 1s delay
    
    while (retries > 0) {
      try {
        console.log(`[Gemini API] Requesting ${model} (Attempts remaining for this model: ${retries})...`);
        const response = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config,
        });
        
        // Success! Return the response
        console.log(`[Gemini API] Successfully received response from ${model}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errMsg = String(error.message || "").toLowerCase();
        const errJson = String(JSON.stringify(error) || "").toLowerCase();
        
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
        if (retries > 0) {
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

// REST API routes must be declared FIRST
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * High-fidelity OCR page extraction endpoint.
 * Takes a base64 encoded image of a scanned/damaged PDF page
 * and extracts clean Urdu, Arabic or English text.
 */
app.post("/api/ocr-page", async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: "براہ کرم صفحہ کی تصویر فراہم کریں۔" });
    }

    const ai = getGeminiClient();
    const cleanMime = mimeType || "image/png";

    const prompt = 
      "You are an expert Urdu, Arabic, and English typesetting, OCR, and composing specialist.\n" +
      "Your task is to transcribe all text of any language from this page image (scanned page image) with 100% fidelity.\n" +
      "Follow these rules strictly:\n" +
      "1. Extract ALL text in its native language. If it is Urdu, transcribe it in Urdu Nastaleeq/Arabic script. If it is Arabic, transcribe in Arabic script with its native vocabulary. If it is English, transcribe in English.\n" +
      "2. Preserve structural paragraphs, lines, list markers, dialogue dashes, and poem layouts (shair/misra structures).\n" +
      "3. STRIP OUT and IGNORING ALL decorative borders, page headers (like chapter titles at the margin), page numbers, website URLs, phone numbers printed at the bottom as advertisement watermarks, or diagonal watermark stamps (e.g., 'Do Not Copy', 'Draft', or publisher credit stamps) completely from the output text. Only output actual body content!\n" +
      "4. Repair typographical and orthographic scan errors seamlessly (for example, connect characters that look broken in scan, join improperly fragmented words, adjust word spacing for a flawless Urdu/Arabic typesetting experience).\n" +
      "5. DO NOT prefix, suffix, or decorate your response with explanations, translation notes, introductions, or code blocks. Output ONLY the raw extracted document body text.";

    const imagePart = {
      inlineData: {
        mimeType: cleanMime,
        data: image,
      },
    };

    const response = await generateContentWithRetryAndFallback({
      primaryModel: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
    });

    const resultText = response.text || "";
    res.json({ text: resultText });
  } catch (error: any) {
    console.error("OCR API error:", error);
    res.status(500).json({ error: error.message || "او سی آر کے دوران خرابی پیش آئی۔" });
  }
});

/**
 * Text refiner (spelling correction, diacritics insertion, translation, summarization)
 */
app.post("/api/refine-text", async (req, res) => {
  try {
    const { text, mode } = req.body;
    if (!text) {
      return res.status(400).json({ error: "براہ کرم ترمیم کرنے کے لئے عبارت فراہم کریں۔" });
    }

    const ai = getGeminiClient();
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

    const response = await generateContentWithRetryAndFallback({
      primaryModel: "gemini-3.5-flash",
      contents: [prompt, text],
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Refining API error:", error);
    res.status(500).json({ error: error.message || "ترمیم کے دوران خرابی پیش آئی۔" });
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
    const cleanMime = mimeType || "audio/webm";

    const prompt = 
      "You are a professional audio transcriber. Transcribe this audio recording with maximum precision.\n" +
      "The audio is likely spoken in Urdu (اردو), Arabic (عربی), or English, or a fluid blend of these.\n" +
      "Your instructions:\n" +
      "1. Listen carefully and output the transcription in the correct native scripts. Urdu speech -> Urdu script, Arabic -> Arabic script with exact words, English -> standard Latin script.\n" +
      "2. Correct speech slip-ups, heavy breathing, hesitation filler words (like 'um', 'uh', 'اہ', 'وں') silences, or repetitive words silently.\n" +
      "3. Only output the actual spoken words, typeset nicely. Do NOT write any introduction, commentary or meta labels.";

    const audioPart = {
      inlineData: {
        mimeType: cleanMime,
        data: audio,
      },
    };

    const response = await generateContentWithRetryAndFallback({
      primaryModel: "gemini-3.5-flash",
      contents: { parts: [audioPart, { text: prompt }] },
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Transcription API error:", error);
    res.status(500).json({ error: error.message || "آڈیو آؤٹ پٹ تیار کرنے میں ناکامی۔" });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Urdu VoiceWriter Backend] Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;

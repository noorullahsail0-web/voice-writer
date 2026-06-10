/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { ComposerDraft, NativeLanguage } from "../types";
import {
  Mic,
  MicOff,
  Copy,
  Share2,
  Mail,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  Wand2,
  Languages,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

interface VoiceComposerProps {
  activeDraft: ComposerDraft;
  onUpdateDraftContent: (content: string) => void;
  onUpdateDraftTitle: (title: string) => void;
}

// Extend Window interface for SpeechRecognition in TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function VoiceComposer({
  activeDraft,
  onUpdateDraftContent,
  onUpdateDraftTitle,
}: VoiceComposerProps) {
  const [language, setLanguage] = useState<NativeLanguage>("ur");
  const [isWebSpeechListening, setIsWebSpeechListening] = useState(false);
  const [isGeminiRecording, setIsGeminiRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Sync state language with standard Web Speech Locales
  const getLocaleForLanguage = (lang: NativeLanguage) => {
    switch (lang) {
      case "ur":
        return "ur-PK";
      case "ar":
        return "ar-SA";
      case "en":
        return "en-US";
      default:
        return "ur-PK";
    }
  };

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = getLocaleForLanguage(language);

      rec.onstart = () => {
        setIsWebSpeechListening(true);
        setErrorMessage("");
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMessage("مائیکروفون کے استعمال کی اجازت مسترد کر دی گئی ہے۔ براہ کرم براؤزر کی سیٹننگز فائل میں جا کر اجازت دیں۔");
        } else {
          setErrorMessage(`سپیچ ریکیگنیشن میں غلطی: ${event.error}`);
        }
        setIsWebSpeechListening(false);
      };

      rec.onend = () => {
        setIsWebSpeechListening(false);
        setInterimTranscript("");
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (finalText) {
          // Append final result with a space
          const currentContent = activeDraft.content;
          const separator = currentContent && !currentContent.endsWith(" ") ? " " : "";
          onUpdateDraftContent(currentContent + separator + finalText);
        }

        setInterimTranscript(interim);
      };

      recognitionRef.current = rec;
    } else {
      console.warn("SpeechRecognition not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, activeDraft.content]);

  // Restart speech recognition if language is changed when listening
  const handleLanguageChange = (lang: NativeLanguage) => {
    setLanguage(lang);
    if (isWebSpeechListening) {
      recognitionRef.current?.stop();
    }
  };

  // Toggle client-side Web Speech Recognition
  const toggleWebSpeech = () => {
    if (!recognitionRef.current) {
      setErrorMessage("آپ کا موجودہ براؤزر براہِ راست آواز سروس کو سپورٹ نہیں کرتا۔ آپ متبادل 'اعلیٰ کوالٹی جیمنی ریکارڈنگ' استعمال کریں۔");
      return;
    }

    if (isWebSpeechListening) {
      recognitionRef.current.stop();
    } else {
      if (isGeminiRecording) {
        stopGeminiRecording();
      }
      setErrorMessage("");
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Start speech failed:", err);
        recognitionRef.current.stop();
      }
    }
  };

  // ----- High Fidelity Server-Side Gemini Recording Methods -----
  const startGeminiRecording = async () => {
    if (isWebSpeechListening) {
      recognitionRef.current?.stop();
    }

    setErrorMessage("");
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        // Clean stream tracks
        stream.getTracks().forEach((track) => track.stop());

        // Process audio bytes
        await processAudioBytesWithGemini(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Collect data every 250ms
      setIsGeminiRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access failed for Gemini:", err);
      setErrorMessage("مائیکروفون تک رسائی ممکن نہیں ہو سکی۔ براہ کرم اپنے سسٹم اور براؤزر کی مائیکروفون پرمیشن درست کریں۔");
    }
  };

  const stopGeminiRecording = () => {
    if (mediaRecorderRef.current && isGeminiRecording) {
      mediaRecorderRef.current.stop();
      setIsGeminiRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const processAudioBytesWithGemini = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setErrorMessage("");

    try {
      // Convert Blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(",")[1];

        const response = await fetch("/api/transcribe-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64data,
            mimeType: "audio/webm",
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "آڈیو پروسیسنگ فیل ہو گئی۔");
        }

        if (data.text) {
          const trans = data.text.trim();
          const currentContent = activeDraft.content;
          const separator = currentContent && !currentContent.endsWith(" ") ? " " : "";
          onUpdateDraftContent(currentContent + separator + trans);
        } else {
          setErrorMessage("آڈیو میں کوئی واضح تحریر سنائی نہیں دی، دوبارہ بولیں۔");
        }
      };
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "آڈیو پروسیسنگ کے دوران رابطے کی غلطی پیش آئی۔");
    } finally {
      setIsProcessing(false);
    }
  };

  // ----- AI Text Refinement Tools -----
  const handleRefineText = async (mode: "imla" | "tashkeel" | "khulasa" | "urdu_translate" | "english_translate") => {
    if (!activeDraft.content) {
      setErrorMessage("اصلاح کرنے کے لیے پہلے کچھ تحریری مسودہ مہیا کیجئے۔");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/refine-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeDraft.content,
          mode: mode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ریفائننگ عمل میں کوئی تعطل آیا ہے۔");
      }

      if (data.text) {
        onUpdateDraftContent(data.text);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "جیمنی ایڈیٹر سروس سے رابطہ منقطع ہے۔");
    } finally {
      setIsProcessing(false);
    }
  };

  // Utility copy
  const copyToClipboard = () => {
    if (!activeDraft.content) return;
    navigator.clipboard.writeText(activeDraft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Share to WhatsApp
  const shareToWhatsApp = () => {
    if (!activeDraft.content) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(activeDraft.content)}`;
    window.open(url, "_blank");
  };

  // Send via Email
  const sendViaEmail = () => {
    if (!activeDraft.content) return;
    const subject = encodeURIComponent(activeDraft.title || "کمپوزنگ شیٹ");
    const body = encodeURIComponent(activeDraft.content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Save to MS Word document wrap
  const downloadAsWord = () => {
    if (!activeDraft.content) return;
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${activeDraft.title || "Urdu-Draft"}</title>
        <style>
          body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; }
          .title { font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #1e3a8a; }
          .content { font-size: 14px; line-height: 2.0; font-family: 'Times New Roman', serif; }
        </style>
      </head>
      <body>
        <div class="title">${activeDraft.title || "بے نام مسودہ"}</div>
        <hr/>
        <div class="content">${activeDraft.content.replace(/\n/g, "<br/>")}</div>
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeDraft.title || "urdu-composer-draft"}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Format recording seconds MM:SS
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Title block */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-3/4 space-y-1.5 text-right">
          <label className="text-xs text-slate-400 font-bold block">مسودے کا عنوان (نام)</label>
          <input
            type="text"
            className="w-full text-lg font-bold font-nastaleeq bg-transparent border-b border-dashed border-slate-200 focus:border-teal-600 focus:outline-none pb-1 transition"
            placeholder="مسودے کا عنوان یہاں لکھیں..."
            value={activeDraft.title}
            onChange={(e) => onUpdateDraftTitle(e.target.value)}
          />
        </div>

        {/* Selected script display info */}
        <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-100 px-3.5 py-1.5 rounded-xl self-end md:self-center">
          <Languages className="w-4 h-4 text-teal-600" />
          <span className="text-xs text-slate-600 font-bold">
            رسم الخط:{" "}
            <strong className="text-teal-700">
              {language === "ur" ? "اردو نستعلیق" : language === "ar" ? "عربی نسخ" : "انگریزی رومن"}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Composer Columns: Speech Controller vs TextArea */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Controllers): Multi Speaking Options (3 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Language Selection card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h4 className="text-sm font-bold font-nastaleeq text-slate-800 border-b border-slate-150 pb-2 flex items-center justify-start gap-2">
              <Languages className="w-4 h-4 text-teal-600" />
              1۔ زبان منتخب کریں:
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleLanguageChange("ur")}
                className={`py-3 rounded-xl font-nastaleeq text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1.5 ${
                  language === "ur"
                    ? "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-md shadow-teal-100/40"
                    : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                }`}
              >
                <span className="text-base text-center">اردو</span>
                <span className="text-[9px] opacity-75">(Nastaleeq)</span>
              </button>

              <button
                onClick={() => handleLanguageChange("ar")}
                className={`py-3 rounded-xl font-nastaleeq text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1.5 ${
                  language === "ar"
                    ? "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-md shadow-teal-100/40"
                    : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                }`}
              >
                <span className="text-base text-center">عربی</span>
                <span className="text-[9px] opacity-75">(Naskh)</span>
              </button>

              <button
                onClick={() => handleLanguageChange("en")}
                className={`py-3 rounded-xl font-sans text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1.5 ${
                  language === "en"
                    ? "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-md shadow-teal-100/40"
                    : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                }`}
              >
                <span className="text-base text-center">English</span>
                <span className="text-[9px] opacity-75">(Latin)</span>
              </button>
            </div>
          </div>

          {/* Interactive Recording buttons block */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <h4 className="text-sm font-bold font-nastaleeq text-slate-800 border-b pb-2">
              2۔ مائیکروفون آن کریں:
            </h4>

            {/* Mode A: Realtime continuous Web Speech */}
            <div className="space-y-2.5">
              <button
                onClick={toggleWebSpeech}
                disabled={isGeminiRecording || isProcessing}
                className={`w-full py-4 px-4 rounded-xl font-nastaleeq font-bold text-sm tracking-wide shadow flex items-center justify-center gap-2.5 transition active:scale-95 duration-200 cursor-pointer ${
                  isWebSpeechListening
                    ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                }`}
              >
                {isWebSpeechListening ? (
                  <>
                    <MicOff className="w-5 h-5 shrink-0" />
                    لکھنا بند کریں (بولنا روکیں)
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 shrink-0" />
                    رئیل ٹائم مسلسل بولیں (Live)
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 text-center leading-relaxed font-nastaleeq">
                (آواز سے لائیو مسلسل سکرین پر ٹائپ کرنے کی تیز سروس)
              </p>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200/70"></div>
              <span className="flex-shrink mx-3 text-slate-350 text-[10px] font-bold uppercase font-nastaleeq">یا بہترین فلو کے لیے</span>
              <div className="flex-grow border-t border-slate-200/70"></div>
            </div>

            {/* Mode B: High Quality Gemini Audio Recording (No timeout, perfect spelling diacritics) */}
            <div className="space-y-2.5">
              {!isGeminiRecording ? (
                <button
                  onClick={startGeminiRecording}
                  disabled={isWebSpeechListening || isProcessing}
                  className="w-full py-3.5 px-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-nastaleeq font-bold text-xs shadow flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-indigo-200 shrink-0" />
                  اعلیٰ کوالٹی صوتی ٹائپنگ (جیمنی AI)
                </button>
              ) : (
                <div className="bg-slate-50 border border-indigo-200 p-3 rounded-xl flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                    <strong className="text-xs font-mono">{formatTimer(recordingSeconds)}</strong>
                    <span className="text-[11px] font-nastaleeq">آڈیو ریکارڈ ہو رہی ہے...</span>
                  </div>
                  <button
                    onClick={stopGeminiRecording}
                    className="w-full py-2 bg-indigo-600 font-nastaleeq font-bold text-xs hover:bg-indigo-700 text-white rounded-lg transition shrink-0"
                  >
                    ریکاڈنگ روک کر جیمنی کو بھیجیں
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-400 text-center leading-relaxed font-nastaleeq">
                (شور مچانے پر بھی الفاظ کی املا متبادل طور پر بالکل درست بناتی ہے)
              </p>
            </div>
          </div>

          {/* Tips box */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/50 space-y-2">
            <h5 className="text-xs font-bold text-amber-800 font-nastaleeq">کمپوزر ٹپ:</h5>
            <p className="text-[11px] text-amber-700 leading-normal font-nastaleeq">
              اگر آواز کے الفاظ میں تھوڑا ردوبدل ہو جائے، تو تحریر مکمل ہونے کے بعد دائیں جانب موجود **"جیمنی املا اصلاح"** فقرہ دبائیں، جیمنی الفاظ کے بیچ فقروں اور رموزِ اوقاف کو درست کر دے گا۔
            </p>
          </div>

        </div>

        {/* Right Column (Composed Area): Text Editor Sheet (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* Main Composed Text Area container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col h-[480px] relative">
            
            {/* Header Area Status line */}
            <div className="bg-slate-50/85 border-b border-slate-100 p-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                {(isWebSpeechListening || isGeminiRecording) && (
                  <span className="flex h-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
                <span className="text-xs text-slate-600 font-nastaleeq font-bold">
                  {isWebSpeechListening
                    ? "مائیک آن ہے، بولنا جاری رکھیں..."
                    : isGeminiRecording
                    ? "آواز ریکارڈ کی جا رہی ہے..."
                    : isProcessing
                    ? "مسودہ پروسیس کیا جا رہا ہے (جیمنی AI)..."
                    : "محفوظ مسودہ تحریر ونڈو"}
                </span>
              </div>
              <div className="text-[10px] text-teal-850 font-bold bg-teal-50 px-2.5 py-0.5 rounded-md">
                {activeDraft.content.length} حروف
              </div>
            </div>

            {/* Realtime Listening Pulse overlay */}
            {(isWebSpeechListening || isProcessing) && (
              <div className="absolute top-12 left-0 right-0 bg-[#f0fcf9]/95 text-teal-800 border-b border-teal-100 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 z-10 font-nastaleeq text-center leading-relaxed">
                {isWebSpeechListening ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce"></span>
                    مائیکروفون فعال ہے۔ بولیں، ہم ٹائپ کر رہے ہیں... 🎙️
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600 shrink-0" />
                    اعلیٰ درجے جیمنی آرٹیفیشل انٹیلیجنس تحریر ترتیب دے رہی ہے...
                  </>
                )}
              </div>
            )}

            {/* Editable Content sheet */}
            <div className="flex-grow p-4 relative overflow-y-auto">
              <textarea
                className={`w-full h-full resize-none bg-transparent outline-none border-none p-1 text-slate-800 ${
                  language === "en"
                    ? "text-left font-sans text-base leading-relaxed"
                    : "text-right font-nastaleeq text-lg leading-loose"
                }`}
                placeholder={
                  language === "ur"
                    ? "مسودہ یہاں ظاہر ہوگا۔ آپ بول کر یا براہِ راست کی بورڈ سے ٹائپ کر کے اضافہ کر سکتے ہیں..."
                    : language === "ar"
                    ? "سيتم استخراج النص العربي هنا تلقائياً، يمكنك التعديل المباشر..."
                    : "Spoken or transcribed English text will appear here. Edit directly..."
                }
                value={activeDraft.content}
                onChange={(e) => onUpdateDraftContent(e.target.value)}
              />

              {/* Interim Speech Output Overlay */}
              {interimTranscript && (
                <div className="p-3 bg-teal-50/90 text-teal-850 rounded-xl mt-2 text-xs border border-teal-100 font-nastaleeq leading-relaxed text-right">
                  <strong>بولے فقرے (فوری لائیو ڈرافٹ):</strong> {interimTranscript}
                </div>
              )}
            </div>

            {/* AI Magic Actions Shelf below composer sheets */}
            {activeDraft.content && (
              <div className="bg-indigo-50/50 p-3 border-t border-indigo-100/60 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] text-indigo-800 font-nastaleeq font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  جیمنی ایڈیٹر مینو:
                </span>
                
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => handleRefineText("imla")}
                    disabled={isProcessing}
                    className="flex items-center gap-1 text-xs bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 px-3 py-1.5 rounded-lg text-slate-700 font-nastaleeq font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-indigo-650" />
                    املا اصلاح (Spellcheck)
                  </button>

                  <button
                    onClick={() => handleRefineText("tashkeel")}
                    disabled={isProcessing}
                    className="flex items-center gap-1 text-xs bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 px-3 py-1.5 rounded-lg text-slate-700 font-nastaleeq font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-650" />
                    اعراب (زیر زبر پیش) اضافہ
                  </button>

                  <button
                    onClick={() => handleRefineText("khulasa")}
                    disabled={isProcessing}
                    className="flex items-center gap-1 text-xs bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 px-3 py-1.5 rounded-lg text-slate-700 font-nastaleeq font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    خلاصہ کریں (Summary)
                  </button>

                  <button
                    onClick={() => handleRefineText("urdu_translate")}
                    disabled={isProcessing}
                    className="flex items-center gap-1 text-xs bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 px-3 py-1.5 rounded-lg text-slate-700 font-nastaleeq font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    اردو ترجمہ کریں
                  </button>

                  <button
                    onClick={() => handleRefineText("english_translate")}
                    disabled={isProcessing}
                    className="flex items-center gap-1 text-xs bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 px-3 py-1.5 rounded-lg text-slate-700 font-nastaleeq font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    English Translation
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions Drawer: Copy, WhatsApp, Email, Word Document export */}
          {activeDraft.content && (
            <div className="flex border-t border-slate-200 pt-4 flex-wrap items-center justify-end gap-2 text-xs">
              <button
                onClick={() => onUpdateDraftContent("")}
                className="flex items-center gap-1 bg-white hover:bg-rose-50 border border-slate-250 text-slate-650 hover:text-rose-600 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer hover:border-rose-350"
              >
                <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                تحریر صاف کریں (Clear)
              </button>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 bg-white border border-slate-250 text-slate-750 hover:border-blue-400 hover:text-blue-600 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition relative cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <Copy className="w-4 h-4 text-blue-500 shrink-0" />}
                {copied ? "کاپیڈ!" : "کاپی کریں (Copy)"}
              </button>

              <button
                onClick={shareToWhatsApp}
                className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-850 hover:text-emerald-900 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-emerald-600 shrink-0" />
                واٹس ایپ کریں (WhatsApp)
              </button>

              <button
                onClick={sendViaEmail}
                className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-250 text-blue-800 hover:text-blue-900 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                <Mail className="w-4 h-4 text-blue-650 shrink-0" />
                ای میل بھیجیں (Email)
              </button>

              <button
                onClick={downloadAsWord}
                className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-250 text-indigo-800 hover:text-indigo-900 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-650 shrink-0" />
                مائیکروسافٹ ورڈ (.doc)
              </button>
            </div>
          )}

          {/* Error Message display */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold leading-normal font-nastaleeq text-right flex items-center justify-start gap-2 animate-bounce">
              <span className="w-2 h-2 bg-red-650 rounded-full animate-ping shrink-0 m-1"></span>
              <span>{errorMessage}</span>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

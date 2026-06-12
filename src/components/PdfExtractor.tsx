/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useRef, useEffect } from "react";
import { ComposerDraft, OcrPageProgress } from "../types";
import {
  FileText,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clipboard,
  Check,
  Share2,
  Mail,
  Download,
  AlertTriangle,
  Layers,
  FileCheck,
} from "lucide-react";

// Dynamically import pdfjs safely
import * as pdfjsLib from "pdfjs-dist";

// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Convert Urdu, Arabic, and Persian numerals (e.g. ۱, ۲, ۳) to standard English ASCII digits (1, 2, 3)
const convertUrduToEnglishDigits = (input: string): string => {
  const map: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
  };
  return input.replace(/[۰-۹٠-٩]/g, (char) => map[char] || char);
};

// Create a safe, same-origin Blob URL that wraps the real worker file (CDN or local).
// This is critical because modern browsers forbid loading Web Workers directly from a cross-origin URL (like unpkg or cdnjs),
// throwing a SecurityError/CORS exception. Creating a dynamic local Blob that imports the real worker via import/importScripts bypasses this security sandboxing restriction.
const getSafeWorkerUrl = (url: string): string => {
  try {
    const isAbsolute = url.startsWith("http://") || url.startsWith("https://");
    const resolvedUrl = isAbsolute ? url : window.location.origin + (url.startsWith("/") ? url : "/" + url);
    const isEsm = resolvedUrl.endsWith(".mjs") || resolvedUrl.includes("/build/pdf.worker.min.mjs") || resolvedUrl.includes(".mjs?");
    const blobCode = isEsm 
      ? `import "${resolvedUrl}";` 
      : `importScripts("${resolvedUrl}");`;
    const blob = new Blob([blobCode], { type: "text/javascript" });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Error creating Blob URL wrapper for PDF worker:", e);
    return url;
  }
};

// Safely and synchronously configure the PDF.js library instance matching version 4.4.168
const configurePdfWorker = () => {
  if (!pdfjsLib || !pdfjsLib.GlobalWorkerOptions) return;

  // We only run this if neither workerPort nor workerSrc is successfully set
  if (pdfjsLib.GlobalWorkerOptions.workerPort || pdfjsLib.GlobalWorkerOptions.workerSrc) {
    return;
  }

  const localMjsUrl = "/pdf.worker.min.mjs";
  const cdnUrl = "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

  try {
    // Priority 1: Direct same-origin ESM Worker
    console.log("[PDF Worker] Attempting native same-origin worker from:", localMjsUrl);
    const workerUrl = new URL(localMjsUrl, window.location.origin);
    pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: "module" });
    console.log("[PDF Worker] Synchronously configured module workerPort.");
  } catch (err) {
    console.warn("[PDF Worker] Direct same-origin worker failed, attempting same-origin blob wrapper:", err);
    try {
      // Priority 2: Safe same-origin blob wrapper referencing the local worker ESM
      const absoluteLocalUrl = new URL(localMjsUrl, window.location.origin).href;
      const blobCode = `import "${absoluteLocalUrl}";`;
      const blob = new Blob([blobCode], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(blobUrl, { type: "module" });
      console.log("[PDF Worker] Synchronously configured local blob wrapper workerPort.");
    } catch (blobErr) {
      console.warn("[PDF Worker] Local blob wrapper failed, falling back to CDN workerSrc:", blobErr);
      try {
        // Priority 3: Fallback using workerSrc to load CDN URL. Direct assignment
        // enables pure-JS main-thread "fake worker" dynamically fetching ESM with confidence.
        pdfjsLib.GlobalWorkerOptions.workerPort = null;
        pdfjsLib.GlobalWorkerOptions.workerSrc = cdnUrl;
        console.log("[PDF Worker] Configured workerSrc as CDN URL.");
      } catch (fallbackErr) {
        console.error("[PDF Worker] Critical error configuring fallbacks:", fallbackErr);
        pdfjsLib.GlobalWorkerOptions.workerSrc = cdnUrl;
      }
    }
  }
};

// Eagerly configure the worker
if (typeof window !== "undefined") {
  configurePdfWorker();
}

const getPdfjsLib = () => {
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    configurePdfWorker();
  }
  return pdfjsLib;
};

interface PdfExtractorProps {
  activeDraft: ComposerDraft;
  onUpdateDraftContent: (content: string) => void;
  onUpdateDraftTitle: (title: string) => void;
}

export default function PdfExtractor({
  activeDraft,
  onUpdateDraftContent,
  onUpdateDraftTitle,
}: PdfExtractorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [ocrMode, setOcrMode] = useState<"ai_ocr" | "direct_text">("ai_ocr");
  const [rangeMode, setRangeMode] = useState<"current" | "range" | "all">("current");
  const [startPageRange, setStartPageRange] = useState<number | "">("");
  const [endPageRange, setEndPageRange] = useState<number | "">("");

  // Extraction Execution states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressList, setProgressList] = useState<OcrPageProgress[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // For visual splitting preview on left
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const isAbortedRef = useRef<boolean>(false);

  // Reset states when files are swapped
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      loadPdf(selectedFile);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      loadPdf(selectedFile);
    }
  };

  // Main pdfjs document loader
  const loadPdf = async (pdfFile: File) => {
    setFile(pdfFile);
    setErrorMessage("");
    setIsProcessing(false);
    setProgressList([]);
    setCurrentPage(1);

    // Auto update draft title if title is empty
    const cleanTitle = pdfFile.name.replace(/\.[^/.]+$/, "");
    if (!activeDraft.title || activeDraft.title === "نیا مسودہ") {
      onUpdateDraftTitle(cleanTitle);
    }

    try {
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        try {
          const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
          
          // Configure worker synchronously
          configurePdfWorker();

          const pdfjs = getPdfjsLib();
          let pdf = null;
          let loadError = null;

          try {
            console.log("Attempting to load PDF with configured workerPort/workerSrc...");
            pdf = await pdfjs.getDocument({ data: typedArray }).promise;
            console.log("Successfully loaded PDF using configured worker!");
          } catch (firstErr: any) {
            console.warn("Initial PDF loading failed, trying fallbacks:", firstErr);
            loadError = firstErr;

            const workersToTry = [
              pdfjsWorker || "",
              "https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs",
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs"
            ].filter(Boolean);

            for (const rawUrl of workersToTry) {
              try {
                console.log(`Trying to initialize PDF.js worker fallback with source: ${rawUrl}`);
                // Clear any prior workerPort so workerSrc is used instead
                pdfjs.GlobalWorkerOptions.workerPort = null;
                pdfjs.GlobalWorkerOptions.workerSrc = getSafeWorkerUrl(rawUrl);
                pdf = await pdfjs.getDocument({ data: typedArray }).promise;
                console.log(`Successfully loaded PDF using fallback source: ${rawUrl}`);
                loadError = null;
                break;
              } catch (err: any) {
                console.warn(`Failed loading PDF with fallback source ${rawUrl}:`, err);
                loadError = err;
              }
            }
          }

          if (!pdf) {
            throw loadError || new Error("All PDF worker fallback targets failed.");
          }

          setPdfDocument(pdf);
          setTotalPages(pdf.numPages);
          setStartPageRange("");
          setEndPageRange("");
        } catch (error: any) {
          console.error("Pdf load error:", error);
          setErrorMessage(`پی ڈی ایف فائل کھولنے میں ناکامی: ${error.message || error}. براہ کرم تصدیق کریں کہ فائل خراب نہیں ہے یا متبادل پی ڈی ایف آزمائیں۔`);
        }
      };
      fileReader.readAsArrayBuffer(pdfFile);
    } catch (err: any) {
      console.error("FileReader error:", err);
      setErrorMessage(`فائل ریڈر کو فعال کرنے میں مسئلہ پیش آیا: ${err.message || err}`);
    }
  };

  // Page renderer on left canvas preview
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        // Cancel previous rendering if any
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDocument.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        // Force premium size and crisp pixel ratio
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException") {
          console.error("Canvas render failed:", err);
        }
      }
    };

    renderPage();
  }, [pdfDocument, currentPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Convert a given page index to standard image base64
  const renderPageToBlobString = async (pageNum: number): Promise<{ base64: string; mimeType: string }> => {
    if (!pdfDocument) throw new Error("دستاویز دستیاب نہیں ہے۔");

    const page = await pdfDocument.getPage(pageNum);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvasing context issue");

    // Dynamically calculate scale to limit image sizes so they are extremely lightweight (~80kb)
    // while keeping them highly legible for Gemini OCR. This prevents connection timeouts 
    // and proxy payload limit blocks ("Failed to fetch").
    const rawViewport = page.getViewport({ scale: 1.0 });
    const maxDimension = 1120; // 1120px is crisp, ultra-legible, yet tiny in JPEG size
    const currentMax = Math.max(rawViewport.width, rawViewport.height);
    const scale = currentMax > maxDimension ? maxDimension / currentMax : 0.90;

    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // Output optimized JPEG quality to cut payloads significantly (approx. 60kb – 120kb per page!)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.70);
    const base64 = dataUrl.split(",")[1];
    return { base64, mimeType: "image/jpeg" };
  };

  // Core Orchestrator for extraction
  const startExtraction = async () => {
    if (!pdfDocument) return;

    setIsProcessing(true);
    setErrorMessage("");
    isAbortedRef.current = false;

    // Compute range boundaries
    let start = 1;
    let end = 1;

    if (rangeMode === "current") {
      start = currentPage;
      end = currentPage;
    } else if (rangeMode === "range") {
      if (startPageRange === "" || endPageRange === "") {
        setErrorMessage("براہِ کرم خاص صفحات کی رینج (صفحہ نمبر اور آخری صفحہ) درج کریں۔");
        setIsProcessing(false);
        return;
      }
      start = Math.max(1, typeof startPageRange === "number" ? startPageRange : 1);
      end = Math.min(totalPages, typeof endPageRange === "number" ? endPageRange : totalPages);
    } else {
      start = 1;
      end = totalPages;
    }

    if (start > end) {
      setErrorMessage("آغاز صفحہ کی تعداد، اختتام صفحہ سے زیادہ نہیں ہو سکتی۔");
      setIsProcessing(false);
      return;
    }

    // Initialize progress arrays
    const list: OcrPageProgress[] = [];
    for (let p = start; p <= end; p++) {
      list.push({ pageNumber: p, status: "pending" });
    }
    setProgressList(list);

    // Process pagestack sequentially
    let currentSessionContent = activeDraft.content || "";

    for (let i = 0; i < list.length; i++) {
      if (isAbortedRef.current) break;

      const pageNum = list[i].pageNumber;

      // Update Page status to processing
      updatePageProgress(pageNum, "processing");

      let cleanPageText = "";
      let isSuccess = false;
      const maxAttempts = 3;
      let delayMs = 1500;
      let lastErrMessage = "پروسیسنگ فیل۔";

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (isAbortedRef.current) break;
        try {
          if (ocrMode === "ai_ocr") {
            // Render to image and send to Gemini OCR
            const { base64, mimeType } = await renderPageToBlobString(pageNum);

            const response = await fetch("/api/ocr-page", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: base64, mimeType }),
            });

            const contentType = response.headers.get("content-type") || "";
            let data: any = {};
            if (contentType.includes("application/json")) {
              data = await response.json();
            } else {
              const textResponse = await response.text();
              const plainText = textResponse.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 300);
              data = { error: plainText || `سرور کی طرف سے غیر متوقع جواب ملا (Status: ${response.status})` };
            }

            if (!response.ok) {
              throw new Error(data.error || "سرور او سی آر رد ہوا۔");
            }

            cleanPageText = data.text || "";
            isSuccess = true;
          } else {
            // Direct digital Text extraction from pdf page metadata
            const page = await pdfDocument.getPage(pageNum);
            const tokenContent = await page.getTextContent();
            const items = tokenContent.items.map((item: any) => item.str);
            
            // Rejoin lines carefully
            cleanPageText = items.join(" ");
            isSuccess = true;
          }
          break; // Break the attempt loop if successful
        } catch (err: any) {
          console.error(`Page ${pageNum} attempt ${attempt} failed:`, err);
          lastErrMessage = err.message || "پروسیسنگ فیل۔";
          
          if (attempt < maxAttempts) {
            // Update Page progress with retry notice for instant feedback
            updatePageProgress(
              pageNum,
              "processing",
              undefined,
              `دوبارہ کوشش جاری ہے... (کوشش ${attempt}/${maxAttempts}: ${lastErrMessage})`
            );
            // Wait with a gentle exponential backoff before the next attempt
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            delayMs *= 1.5;
          }
        }
      }

      if (isAbortedRef.current) break;

      // Smart Fallback: If AI OCR failed (e.g. quota limit reached), attempt to read digital text directly as fallback
      if (!isSuccess && ocrMode === "ai_ocr") {
        try {
          console.log(`Page ${pageNum} AI OCR failed. Attempting digital text fallback extraction...`);
          const originalOcrError = lastErrMessage;
          updatePageProgress(
            pageNum,
            "processing",
            undefined,
            "جیمنی او سی آر فیل ہونے کی وجہ سے ہم براہِ راست ڈیجیٹل ٹیکسٹ نکالنے کی کوشش کر رہے ہیں..."
          );
          
          const page = await pdfDocument.getPage(pageNum);
          const tokenContent = await page.getTextContent();
          const items = tokenContent.items.map((item: any) => item.str);
          const fallbackText = items.join(" ");
          
          if (fallbackText && fallbackText.trim().length > 0) {
            cleanPageText = fallbackText;
            isSuccess = true;
            console.log(`Page ${pageNum} digital text fallback succeeded!`);
          } else {
            // Keep the original OCR error, but append info about scanned page fallback failure!
            lastErrMessage = `سرور جواب: ${originalOcrError}۔ (مزید معلومات: یہ اسکین شدہ تصویر یا نان-ڈیجیٹل صفحہ معلوم ہوتا ہے جس میں سے براہِ راست متن نکالنا ممکن نہیں ہے)۔`;
          }
        } catch (fallbackErr: any) {
          console.error(`Page ${pageNum} digital fallback failed:`, fallbackErr);
          lastErrMessage = `او سی آر ناکام ہوا (${lastErrMessage}) اور ڈیجیٹل ٹیکسٹ نکالنے میں بھی خرابی آئی: ${fallbackErr.message || fallbackErr}`;
        }
      }

      if (isSuccess) {
        updatePageProgress(pageNum, "success", cleanPageText);

        // Safely accumulate content and dispatch state update to the parent draft
        if (cleanPageText) {
          if (currentSessionContent) {
            currentSessionContent += "\n\n" + cleanPageText;
          } else {
            currentSessionContent = cleanPageText;
          }
          onUpdateDraftContent(currentSessionContent);
        }

        // Wait for a small segment if we are in AI OCR mode to prevent hitting API Requests-Per-Minute (RPM) limits
        if (ocrMode === "ai_ocr" && i < list.length - 1) {
          updatePageProgress(
            pageNum,
            "success",
            cleanPageText,
            "اگلے صفحے سے پہلے معمولی وقفہ (سرور تحفظ)..."
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
          // Clear the brief interval message after wait
          updatePageProgress(pageNum, "success", cleanPageText, undefined);
        }
      } else {
        updatePageProgress(pageNum, "failed", undefined, lastErrMessage);
      }
    }

    setIsProcessing(false);
  };

  const updatePageProgress = (
    pageNum: number,
    status: "pending" | "processing" | "success" | "failed",
    text?: string,
    error?: string
  ) => {
    setProgressList((prev) =>
      prev.map((item) =>
        item.pageNumber === pageNum
          ? { ...item, status, extractedText: text, errorMessage: error }
          : item
      )
    );
  };

  const abortExtraction = () => {
    isAbortedRef.current = true;
    setIsProcessing(false);
  };

  // Utils copying
  const handleCopyText = () => {
    if (!activeDraft.content) return;
    navigator.clipboard.writeText(activeDraft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // WhatsApp share
  const shareToWhatsApp = () => {
    if (!activeDraft.content) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(activeDraft.content)}`;
    window.open(url, "_blank");
  };

  // Email
  const sendViaEmail = () => {
    if (!activeDraft.content) return;
    const subject = encodeURIComponent(activeDraft.title || "پی ڈی ایف خلاصہ شدہ تحریر");
    const body = encodeURIComponent(activeDraft.content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Word doc download wrapper
  const handleDownloadWord = () => {
    if (!activeDraft.content) return;
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${activeDraft.title || "PDF-Extract"}</title>
        <style>
          body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #312e81; }
          .content { font-size: 14px; line-height: 2.1; font-family: 'Times New Roman', serif; }
        </style>
      </head>
      <body>
        <div class="title">${activeDraft.title || "پی ڈی ایف حاصل شدہ تحریر"}</div>
        <hr/>
        <div class="content">${activeDraft.content.replace(/\n/g, "<br/>")}</div>
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeDraft.title || "extracted-pdf-content"}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* 1. Drag and drop file upload region */}
      {!file ? (
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          className="bg-white p-12 border-2 border-dashed border-slate-200 rounded-3xl hover:border-indigo-400 hover:bg-indigo-50/10 transition duration-200 cursor-pointer flex flex-col items-center justify-center text-center space-y-4"
        >
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            id="pdf-file-selector"
            onChange={handleFileChange}
          />
          <label htmlFor="pdf-file-selector" className="cursor-pointer space-y-4 block">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-indigo-650 shadow-inner group-hover:scale-105 transition">
              <UploadCloud className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-nastaleeq font-bold text-slate-800">کمپوز کرنے والی پی ڈی ایف فائل اپلوڈ کریں</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                خراب کوالٹی کے ناولز، خلاصے یا دیگر صفحات کی فائل کھینچ کر یہاں لائیں یا <strong> براؤز کریں۔</strong>
              </p>
            </div>
            <div className="text-[10px] bg-slate-100 text-slate-500 py-1.5 px-3 rounded-lg inline-block font-nastaleeq font-bold">
              فارم: صرف PDF فائلیں۔ سائز کی کوئی حد مقرر نہیں ہے۔
            </div>
          </label>
        </div>
      ) : (
        // File is loaded, render split screens
        <div className="space-y-6">
          {/* File details bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 justify-start">
              <div className="bg-rose-50 text-rose-500 p-2.5 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-0.5 text-right">
                <h4 className="font-nastaleeq font-bold text-slate-800 text-sm line-clamp-1">{file.name}</h4>
                <p className="text-[10px] text-slate-450 font-mono">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • کل صفحات: {totalPages}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFile(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-4 py-2 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                دوسری فائل چنیں
              </button>
            </div>
          </div>

          {/* Quick Config Shelf card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Mode selection */}
            <div className="space-y-2 text-right">
              <label className="text-xs text-slate-500 font-bold font-nastaleeq block">1۔ ایکسٹریکشن موڈ (کیفیت)</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setOcrMode("ai_ocr")}
                  className={`py-2.5 rounded-xl text-xs font-nastaleeq font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    ocrMode === "ai_ocr" ? "bg-gradient-to-tr from-indigo-700 to-indigo-850 text-white shadow-md shadow-indigo-100/40" : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  جیمنی بصری او سی آر
                </button>
                <button
                  type="button"
                  onClick={() => setOcrMode("direct_text")}
                  className={`py-2.5 rounded-xl text-xs font-nastaleeq font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    ocrMode === "direct_text" ? "bg-gradient-to-tr from-indigo-700 to-indigo-850 text-white shadow-md shadow-indigo-100/40" : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  براہِ راست ٹیکسٹ ریڈر
                </button>
              </div>
              <p className="text-[9px] text-teal-800 font-medium bg-teal-50 px-2.5 py-0.5 rounded-md font-nastaleeq leading-tight mt-1 inline-block">
                *جیمنی موڈ خراب پرنٹس اور اسکین شدہ اوراق کے لیے بہترین ہے۔
              </p>
            </div>

            {/* Range selection */}
            <div className="space-y-2 text-right">
              <label className="text-xs text-slate-500 font-bold font-nastaleeq block">2۔ صفحات کا دائرہ (رینج)</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRangeMode("current")}
                  className={`py-2.5 rounded-xl text-xs font-bold font-nastaleeq transition cursor-pointer ${
                    rangeMode === "current" ? "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-md shadow-teal-100/40" : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                  }`}
                >
                  صرف یہ صفحہ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRangeMode("range");
                    setStartPageRange("");
                    setEndPageRange("");
                  }}
                  className={`py-2.5 rounded-xl text-xs font-bold font-nastaleeq transition cursor-pointer ${
                    rangeMode === "range" ? "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-md shadow-teal-100/40" : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                  }`}
                >
                  خاص صفحات
                </button>
                <button
                  type="button"
                  onClick={() => setRangeMode("all")}
                  className={`py-2.5 rounded-xl text-xs font-bold font-nastaleeq transition cursor-pointer ${
                    rangeMode === "all" ? "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-md shadow-teal-100/40" : "bg-slate-50 text-slate-650 hover:bg-slate-100"
                  }`}
                >
                  پورے صفحات
                </button>
              </div>

              {/* Dynamic Sub-items ranges box */}
              {rangeMode === "range" && (
                <div className="flex items-center gap-2 justify-end pt-1">
                  <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-nastaleeq">تک:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={endPageRange}
                      onChange={(e) => {
                        const val = e.target.value;
                        const converted = convertUrduToEnglishDigits(val);
                        const clean = converted.replace(/[^0-9]/g, "");
                        setEndPageRange(clean === "" ? "" : Math.min(totalPages > 0 ? totalPages : 9999, Math.max(1, parseInt(clean) || 1)));
                      }}
                      placeholder={totalPages > 0 ? totalPages.toString() : ""}
                      className="w-12 text-center bg-transparent text-xs font-mono font-bold border-none outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-nastaleeq">صفحہ نمبر:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={startPageRange}
                      onChange={(e) => {
                        const val = e.target.value;
                        const converted = convertUrduToEnglishDigits(val);
                        const clean = converted.replace(/[^0-9]/g, "");
                        setStartPageRange(clean === "" ? "" : Math.min(totalPages > 0 ? totalPages : 9999, Math.max(1, parseInt(clean) || 1)));
                      }}
                      placeholder="1"
                      className="w-12 text-center bg-transparent text-xs font-mono font-bold border-none outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Run button controller */}
            <div className="flex flex-col justify-end space-y-1 md:pb-1">
              {!isProcessing ? (
                <button
                  onClick={startExtraction}
                  className="w-full py-3.5 bg-gradient-to-tr from-teal-700 to-teal-850 hover:from-teal-800 hover:to-teal-900 text-white font-nastaleeq font-bold text-sm rounded-xl shadow-lg shadow-teal-100/50 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 shrink-0" />
                  ٹیکسٹ میں تبدیل کرنا شروع کریں
                </button>
              ) : (
                <button
                  onClick={abortExtraction}
                  className="w-full py-3.5 bg-gradient-to-tr from-rose-600 to-rose-750 hover:from-rose-700 hover:to-rose-800 text-white font-nastaleeq font-bold text-sm rounded-xl shadow-lg shadow-rose-100/50 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Pause className="w-4 h-4 shrink-0" />
                  پروسیسنگ روک دیں (Pause)
                </button>
              )}
            </div>
          </div>

          {/* SPLIT SCREEN PREVIEW: Original vs OCR Output results */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[550px]">
            
            {/* Left Screen: Original Document Live Preview (5 Cols) */}
            <div className="lg:col-span-5 bg-slate-850 p-4 rounded-2xl flex flex-col h-full overflow-hidden border border-slate-750 shadow-inner relative justify-between">
              
              <div className="text-slate-300 text-xs font-bold pb-2 flex items-center justify-between border-b border-slate-700/60 font-nastaleeq">
                <span>اصل پی ڈی ایف کی تصویرِ صفحہ</span>
                <span className="bg-slate-700 text-slate-100 text-[10px] px-2 py-0.5 rounded font-mono">
                  صفحہ {currentPage} / {totalPages}
                </span>
              </div>

              {/* PDF Image canvas */}
              <div className="flex-grow flex items-center justify-center overflow-auto my-3 p-1 max-h-[420px]">
                <canvas ref={canvasRef} className="max-w-full max-h-full border border-slate-700 shadow-md bg-white rounded" />
              </div>

              {/* Navigation toolbar below */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-700/60 pt-3">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || isProcessing}
                  className="p-1 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-200 flex items-center gap-1 transition text-xs font-nastaleeq cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  پچھلا صفحہ
                </button>

                <div className="text-slate-300 text-xs font-mono font-bold flex items-center gap-1">
                  صفحہ <span className="text-white text-sm">{currentPage}</span>
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || isProcessing}
                  className="p-1 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-200 flex items-center gap-1 transition text-xs font-nastaleeq cursor-pointer"
                >
                  اگلا صفحہ
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Screen: Transcribed Output text sheet (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-250 shadow-sm flex flex-col h-full overflow-hidden relative">
              <div className="bg-slate-50 border-b border-slate-150 p-3.5 text-slate-750 text-xs font-bold font-nastaleeq flex items-center justify-between">
                <span>حاصل شدہ سادہ کمپوزر تحریر</span>
                <span className="text-xs text-slate-450 font-mono">
                  {activeDraft.content.length} اسکیپڈ حروف
                </span>
              </div>

              <div className="flex-grow p-4 overflow-y-auto">
                <textarea
                  className="w-full h-full resize-none bg-transparent outline-none border-none p-1 text-slate-800 font-nastaleeq text-lg leading-loose"
                  placeholder="تبدیل شدہ ٹیکسٹ مسودہ یہاں نمودار ہوگا، اور آپ اس میں لائیو ردو بدل کر سکتے ہیں..."
                  value={activeDraft.content}
                  onChange={(e) => onUpdateDraftContent(e.target.value)}
                />
              </div>
            </div>

          </div>

          {/* Progress stack list in Grid for multi pages conversions */}
          {progressList.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-sm font-bold font-nastaleeq text-slate-800 flex items-center justify-start gap-1.5 border-b pb-2">
                <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                تبدیل کاری کی نگرانی گلی (Progress Stack):
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {progressList.map((item) => (
                  <div
                    key={item.pageNumber}
                    onClick={() => {
                      if (!isProcessing) setCurrentPage(item.pageNumber);
                    }}
                    title={item.errorMessage ? `خرابی: ${item.errorMessage}` : `صفحہ ${item.pageNumber}`}
                    className={`p-2.5 border rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center ${
                      item.status === "success"
                        ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                        : item.status === "processing"
                        ? "bg-blue-50 border-blue-250 text-blue-800 animate-pulse"
                        : item.status === "failed"
                        ? "bg-rose-50 border-rose-250 text-rose-850 hover:bg-rose-100"
                        : "bg-slate-50 border-slate-200 text-slate-505"
                    }`}
                  >
                    <span className="text-[10px] font-bold font-nastaleeq">صفحہ {item.pageNumber}</span>
                    <span className="text-[9px] font-mono font-medium block uppercase opacity-80 mt-0.5">
                      {item.status === "success"
                        ? "کامیابی"
                        : item.status === "processing"
                        ? "لوڈ ہو رہا..."
                        : item.status === "failed"
                        ? "ناکام"
                        : "پینڈنگ"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Specific failed pages error logs */}
              {progressList.some((item) => item.status === "failed") && (
                <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-850">
                  <div className="font-bold font-nastaleeq flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ناکام صفحات کی خرابیاں (Page Errors):
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1" dir="rtl">
                    {progressList
                      .filter((item) => item.status === "failed")
                      .map((item) => (
                        <div key={item.pageNumber} className="bg-white/80 p-2.5 rounded-lg border border-rose-100 font-mono text-right text-[11px] leading-relaxed flex flex-col sm:flex-row sm:items-center justify-start gap-1.5">
                          <span className="font-nastaleeq font-bold text-rose-900 shrink-0 bg-rose-100 py-0.5 px-2 rounded-md">
                            صفحہ {item.pageNumber}:
                          </span>
                          <span className="text-slate-750 font-sans font-medium">
                            {item.errorMessage || "نامعلوم خرابی پیش آئی۔"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions Shelf below split screens: Copy, Word Document wrapper */}
          {activeDraft.content && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs pt-2">
              <button
                onClick={() => onUpdateDraftContent("")}
                className="flex items-center gap-1.5 bg-white hover:bg-rose-50 border border-slate-250 text-slate-650 hover:text-rose-600 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                تحریر صاف کریں (Clear)
              </button>

              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 bg-white border border-slate-250 text-slate-750 hover:border-blue-400 hover:text-blue-600 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition relative cursor-pointer"
              >
                {copied ? <Check className="w-4.5 h-4.5 text-emerald-500" /> : <Clipboard className="w-4.5 h-4.5 text-blue-500" />}
                {copied ? "کاپی ہوگیا!" : "تحریر کاپی کریں"}
              </button>

              <button
                onClick={shareToWhatsApp}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 hover:text-emerald-990 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                <Share2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                واٹس ایپ کریں (WhatsApp)
              </button>

              <button
                onClick={sendViaEmail}
                className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-250 text-blue-800 hover:text-blue-995 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                <Mail className="w-4.5 h-4.5 text-blue-650 shrink-0" />
                ای میل بھیجیں (Email)
              </button>

              <button
                onClick={handleDownloadWord}
                className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-250 text-indigo-805 hover:text-indigo-995 px-4 py-2.5 rounded-xl font-nastaleeq font-bold transition cursor-pointer"
              >
                <Download className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                مائیکروسافٹ ورڈ (.doc)
              </button>
            </div>
          )}

          {/* Quick Alert advisory banner */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold font-nastaleeq text-right flex items-center justify-start gap-2 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

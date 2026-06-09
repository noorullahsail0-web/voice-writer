/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { ComposerDraft } from "../types";
import { Trash2, FileText, Calendar, Edit3, Search, Share2, Copy, Download, Plus } from "lucide-react";

interface DraftsHistoryProps {
  drafts: ComposerDraft[];
  onSelectDraft: (draft: ComposerDraft) => void;
  onDeleteDraft: (id: string) => void;
  onAddNewDraft: () => void;
}

export default function DraftsHistory({
  drafts,
  onSelectDraft,
  onDeleteDraft,
  onAddNewDraft,
}: DraftsHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredDrafts = drafts.filter(
    (draft) =>
      draft.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadWord = (draft: ComposerDraft) => {
    // Generate simple Word doc format
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${draft.title}</title>
        <style>
          body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 15px; }
          .content { font-size: 14px; line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="title">${draft.title}</div>
        <hr/>
        <div class="content">${draft.content.replace(/\n/g, "<br/>")}</div>
      </body>
      </html>
    `;
    const blob = new Blob(["\ufeff" + content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title || "be-naam-draft"}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatUrduDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ur-PK", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-250/70 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute right-3.5 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="مسودات میں تلاش کریں..."
            className="w-full pr-11 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={onAddNewDraft}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-nastaleeq px-5 py-2 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Plus className="w-5 h-5 shrink-0" />
          نیا مسودہ (نیا پیج)
        </button>
      </div>

      {filteredDrafts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-250/70 shadow-sm text-center space-y-4">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-nastaleeq font-bold text-slate-800">کوئی مسودہ نہیں ملا</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {searchTerm
                ? "آپ کی تلاش سے مطابقت رکھتا ہوا کوئی ریکارڈ نہیں ملا۔ سرچ فقرہ تبدیل کریں۔"
                : "ابھی تک آپ نے کوئی کمپوزنگ شیٹ محفوظ نہیں کی ہے۔ وائس کومپوز یا پی ڈی ایف ریڈر سے کام شروع کریں۔"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition duration-200 flex flex-col h-72 group relative overflow-hidden"
            >
              {/* Draft Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-nastaleeq font-bold text-slate-800 line-clamp-1 text-base group-hover:text-blue-600 transition">
                    {draft.title || "بے نام مسودہ"}
                  </h4>
                  <p className="text-[10px] text-slate-450 flex items-center gap-1 justify-start">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatUrduDate(draft.lastModifiedAt)}
                  </p>
                </div>
                <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                  {draft.language === "ur" ? "اردو" : draft.language === "ar" ? "عربی" : "انگلش"}
                </div>
              </div>

              {/* Draft Snippet Body */}
              <div className="p-5 flex-grow overflow-hidden">
                <p
                  className={`text-slate-600 text-sm line-clamp-4 leading-relaxed ${
                    draft.language === "en" ? "text-left font-sans" : "font-nastaleeq text-right"
                  }`}
                >
                  {draft.content}
                </p>
              </div>

              {/* Draft Actions Card Drawer */}
              <div className="p-4 bg-slate-50/75 border-t border-slate-100 flex items-center justify-between gap-1.5 mt-auto">
                {/* Left controls: Delete */}
                <button
                  onClick={() => onDeleteDraft(draft.id)}
                  title="مٹا دیں"
                  className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Right controls: Share / Copy / Word / Edit */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyText(draft.content, draft.id)}
                    title="کاپی کریں"
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition relative cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedId === draft.id && (
                      <span className="absolute -top-7 right-1/2 translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow">
                        کاپیڈ!
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleDownloadWord(draft)}
                    title="مائیکروسافٹ ورڈ ڈاؤن لوڈ"
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onSelectDraft(draft)}
                    className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-nastaleeq transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    ترمیم کریں
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

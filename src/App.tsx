/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ActiveTab, ComposerDraft } from "./types";
import Sidebar from "./components/Sidebar";
import VoiceComposer from "./components/VoiceComposer";
import PdfExtractor from "./components/PdfExtractor";
import DraftsHistory from "./components/DraftsHistory";
import HelpManual from "./components/HelpManual";
import { Sparkles, Mic, FileText, Settings, BookOpen, AlertCircle, History, Menu, X } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.VoiceComposer);
  const [drafts, setDrafts] = useState<ComposerDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load drafts on startup
  useEffect(() => {
    const storedDraftsStr = localStorage.getItem("urdu_composer_drafts");
    if (storedDraftsStr) {
      try {
        const parsedDrafts = JSON.parse(storedDraftsStr);
        setDrafts(parsedDrafts);
        if (parsedDrafts.length > 0) {
          setActiveDraftId(parsedDrafts[0].id);
        } else {
          createNewDraft();
        }
      } catch (err) {
        console.error("Local drafts parse error:", err);
        createNewDefaultDraft();
      }
    } else {
      createNewDefaultDraft();
    }
  }, []);

  // Save drafts when updated
  const saveDraftsToStorage = (updatedDrafts: ComposerDraft[]) => {
    setDrafts(updatedDrafts);
    localStorage.setItem("urdu_composer_drafts", JSON.stringify(updatedDrafts));
  };

  const createNewDefaultDraft = () => {
    const defaultDraft: ComposerDraft = {
      id: "default-draft",
      title: "پہلا کمپوزنگ مسودہ",
      content: "",
      language: "ur",
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    };
    saveDraftsToStorage([defaultDraft]);
    setActiveDraftId(defaultDraft.id);
  };

  const createNewDraft = () => {
    const newId = `draft-${Date.now()}`;
    const newDraft: ComposerDraft = {
      id: newId,
      title: `مسودہ نمبر ${drafts.length + 1}`,
      content: "",
      language: "ur",
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
    };
    saveDraftsToStorage([newDraft, ...drafts]);
    setActiveDraftId(newId);
    setActiveTab(ActiveTab.VoiceComposer);
  };

  const activeDraft = drafts.find((d) => d.id === activeDraftId) || drafts[0] || {
    id: "temp",
    title: "نیا مسودہ",
    content: "",
    language: "ur",
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
  };

  const handleUpdateDraftContent = (content: string) => {
    const updated = drafts.map((d) =>
      d.id === activeDraft.id
        ? { ...d, content, lastModifiedAt: new Date().toISOString() }
        : d
    );
    saveDraftsToStorage(updated);
  };

  const handleUpdateDraftTitle = (title: string) => {
    const updated = drafts.map((d) =>
      d.id === activeDraft.id
        ? { ...d, title, lastModifiedAt: new Date().toISOString() }
        : d
    );
    saveDraftsToStorage(updated);
  };

  const handleDeleteDraft = (id: string) => {
    const updated = drafts.filter((d) => d.id !== id);
    if (updated.length === 0) {
      const defaultDraft: ComposerDraft = {
        id: "default-draft",
        title: "نیا مسودہ",
        content: "",
        language: "ur",
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      };
      saveDraftsToStorage([defaultDraft]);
      setActiveDraftId(defaultDraft.id);
    } else {
      saveDraftsToStorage(updated);
      if (activeDraftId === id) {
        setActiveDraftId(updated[0].id);
      }
    }
  };

  const handleSelectDraftToEdit = (draft: ComposerDraft) => {
    setActiveDraftId(draft.id);
    setActiveTab(ActiveTab.VoiceComposer);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50/70" dir="rtl">
      
      {/* Mobile Top Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 transition"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-sm font-bold font-nastaleeq text-slate-800 leading-none">اردو صوتی وائس رائٹر</h1>
        </div>
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-lg">
          <Sparkles className="w-4 h-4" />
        </div>
      </header>

      {/* Sidebar navigation */}
      <div
        className={`${
          isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } fixed lg:static inset-y-0 right-0 w-72 z-30 transform transition-transform duration-300 lg:transition-none bg-white border-l border-slate-200 flex-shrink-0 h-full`}
      >
        <Sidebar
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false);
          }}
          draftsCount={drafts.length}
        />
      </div>

      {/* Sidebar mobile overlay background */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-20 lg:hidden transition-opacity"
        />
      )}

      {/* Main Panel Content container */}
      <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
        
        {/* Dynamic header tracker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
          <div className="space-y-1.5 text-right w-full sm:w-auto">
            <h2 className="text-2xl font-bold font-nastaleeq text-slate-950 tracking-tight leading-relaxed">
              {activeTab === ActiveTab.VoiceComposer
                ? "صوتی گاہ (Voice Composer Sheet)"
                : activeTab === ActiveTab.PdfExtractor
                ? "پی ڈی ایف او سی آر ایکسٹریکٹر (scanned PDF Reader)"
                : activeTab === ActiveTab.SavedDrafts
                ? "آپ کے محفوظ مسودات"
                : "مدد اور صارف دستی کتابچہ"}
            </h2>
            <p className="text-xs text-slate-400 font-nastaleeq">
              {activeTab === ActiveTab.VoiceComposer
                ? "آواز کے ذریعے لائیو کلاؤڈ کمپوزنگ پینل"
                : activeTab === ActiveTab.PdfExtractor
                ? "اسکین کتابوں اور کاپیوں کو دوبارہ تحریر میں حاصل کیا جا سکتا ہے"
                : activeTab === ActiveTab.SavedDrafts
                ? "سابقہ کاموں کے فائنل ڈرافٹس"
                : "ایپلی کیشن کے فوائد اور استعمال کا آسان طریقہ"}
            </p>
          </div>
        </div>

        {/* Dynamic landing Dashboard buttons shown in every page if they want a fast switch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-2">
          {/* Dashboard action card 1 - Voice composing */}
          <button
            onClick={() => setActiveTab(ActiveTab.VoiceComposer)}
            className={`p-6 rounded-2xl border transition duration-200 text-right flex items-center justify-between shadow-sm cursor-pointer group ${
              activeTab === ActiveTab.VoiceComposer
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-white border-slate-200/80 hover:border-slate-350 text-slate-800"
            }`}
          >
            <div className="space-y-1.5 max-w-[80%]">
              <h3 className="text-base font-bold font-nastaleeq leading-relaxed">
                (1) آواز سے تحریر لکھیں (Voice Composer)
              </h3>
              <p className={`text-[11px] font-nastaleeq ${activeTab === ActiveTab.VoiceComposer ? "text-blue-105" : "text-slate-450"}`}>
                اردو، عربی اور انگریزی آواز کو سن کر لائیو ٹائپ کرنے کا تیز ترین مائیک ٹول۔
              </p>
            </div>
            <div className={`p-3.5 rounded-full ${activeTab === ActiveTab.VoiceComposer ? "bg-white/20 text-white" : "bg-blue-50 text-blue-500 group-hover:scale-105 transition"}`}>
              <Mic className="w-6 h-6" />
            </div>
          </button>

          {/* Dashboard action card 2 - PDF extractor */}
          <button
            onClick={() => setActiveTab(ActiveTab.PdfExtractor)}
            className={`p-6 rounded-2xl border transition duration-200 text-right flex items-center justify-between shadow-sm cursor-pointer group ${
              activeTab === ActiveTab.PdfExtractor
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-white border-slate-200/80 hover:border-slate-350 text-slate-800"
            }`}
          >
            <div className="space-y-1.5 max-w-[80%]">
              <h3 className="text-base font-bold font-nastaleeq leading-relaxed">
                (2) پی ڈی ایف سے سادہ ٹیکسٹ نکالیں (PDF Extractor)
              </h3>
              <p className={`text-[11px] font-nastaleeq ${activeTab === ActiveTab.PdfExtractor ? "text-indigo-105" : "text-slate-450"}`}>
                واٹر مارک اور بارڈرز کے بغیر خراب کوالٹی کی پی ڈی ایف کو ورڈ ٹیکسٹ میں تبدیل کریں۔
              </p>
            </div>
            <div className={`p-3.5 rounded-full ${activeTab === ActiveTab.PdfExtractor ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-500 group-hover:scale-105 transition"}`}>
              <FileText className="w-6 h-6" />
            </div>
          </button>
        </div>

        {/* Master Workspace Routing panel based on activeTab */}
        <div className="bg-slate-50/30 p-1 rounded-2xl">
          {activeTab === ActiveTab.VoiceComposer && (
            <VoiceComposer
              activeDraft={activeDraft}
              onUpdateDraftContent={handleUpdateDraftContent}
              onUpdateDraftTitle={handleUpdateDraftTitle}
            />
          )}

          {activeTab === ActiveTab.PdfExtractor && (
            <PdfExtractor
              activeDraft={activeDraft}
              onUpdateDraftContent={handleUpdateDraftContent}
              onUpdateDraftTitle={handleUpdateDraftTitle}
            />
          )}

          {activeTab === ActiveTab.SavedDrafts && (
            <DraftsHistory
              drafts={drafts}
              onSelectDraft={handleSelectDraftToEdit}
              onDeleteDraft={handleDeleteDraft}
              onAddNewDraft={createNewDraft}
            />
          )}

          {activeTab === ActiveTab.HelpManual && <HelpManual />}
        </div>

      </main>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActiveTab } from "../types";
import { Mic, FileText, History, BookOpen, Menu, Sparkles } from "lucide-react";

interface SidebarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  draftsCount: number;
}

export default function Sidebar({
  activeTab,
  onChangeTab,
  draftsCount,
}: SidebarProps) {
  const menuItems = [
    {
      id: ActiveTab.VoiceComposer,
      title: "آواز سے لکھنا (Voice Writer)",
      icon: Mic,
      color: "text-teal-600",
      bg: "hover:bg-teal-50/60 hover:text-teal-700",
      activeBg: "bg-gradient-to-tr from-teal-700 to-teal-850 text-white shadow-lg shadow-teal-100/40",
    },
    {
      id: ActiveTab.PdfExtractor,
      title: "پی ڈی ایف تبدیل کار (PDF to Text)",
      icon: FileText,
      color: "text-indigo-600",
      bg: "hover:bg-indigo-50/60 hover:text-indigo-700",
      activeBg: "bg-gradient-to-tr from-indigo-700 to-indigo-850 text-white shadow-lg shadow-indigo-100/40",
    },
    {
      id: ActiveTab.SavedDrafts,
      title: "محفوظ مسودات (Drafts Library)",
      icon: History,
      color: "text-amber-600",
      bg: "hover:bg-amber-50/60 hover:text-amber-700",
      activeBg: "bg-gradient-to-tr from-amber-600 to-amber-750 text-white shadow-lg shadow-amber-100/40",
      badge: draftsCount,
    },
    {
      id: ActiveTab.HelpManual,
      title: "رہنمائی کتابچہ (Operating Guide)",
      icon: BookOpen,
      color: "text-slate-600",
      bg: "hover:bg-slate-50 hover:text-slate-800",
      activeBg: "bg-slate-800 text-white shadow-md",
    },
  ];

  return (
    <div className="w-full lg:w-72 bg-white border-l border-slate-200/80 flex flex-col h-full shrink-0 text-right" dir="rtl">
      
      {/* Brand logo display */}
      <div className="p-6 border-b border-slate-100/80 flex items-center justify-start gap-3">
        <div className="bg-gradient-to-tr from-teal-700 via-teal-850 to-indigo-750 text-white p-2.5 rounded-xl shadow-md shadow-teal-50/30">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-base font-bold font-nastaleeq text-slate-900 tracking-tight leading-relaxed">
            اردو کمپوزر پرو
          </h2>
          <p className="text-[10px] text-teal-800 font-nastaleeq font-medium bg-teal-50 px-2 py-0.5 rounded-lg inline-block">صوتی و ڈیجیٹل معاون</p>
        </div>
      </div>

      {/* Nav list elements */}
      <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl text-xs font-bold font-nastaleeq transition duration-200 cursor-pointer ${
                isActive ? item.activeBg : `text-slate-600 ${item.bg}`
              }`}
            >
              <div className="flex items-center gap-3 justify-start">
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-white" : item.color}`} />
                <span>{item.title}</span>
              </div>
              
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer metadata instructions credits */}
      <div className="p-4 border-t border-slate-100 bg-[#f9fbfb]">
        <div className="text-[10px] text-teal-900/60 font-nastaleeq leading-relaxed text-right pr-1">
          عربی، اردو اور انگریزی آواز کی خودکار پبلشنگ گریڈ درستی کے لیے جیمنی AI ماڈل استعمال کیا جا رہا ہے۔
        </div>
      </div>

    </div>
  );
}

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
      color: "text-blue-500",
      bg: "hover:bg-blue-50/80 hover:text-blue-600",
      activeBg: "bg-blue-600 text-white shadow-md shadow-blue-100",
    },
    {
      id: ActiveTab.PdfExtractor,
      title: "پی ڈی ایف تبدیل کار (PDF to Text)",
      icon: FileText,
      color: "text-indigo-500",
      bg: "hover:bg-indigo-50/80 hover:text-indigo-600",
      activeBg: "bg-indigo-600 text-white shadow-md shadow-indigo-100",
    },
    {
      id: ActiveTab.SavedDrafts,
      title: "محفوظ مسودات (Drafts Library)",
      icon: History,
      color: "text-amber-500",
      bg: "hover:bg-amber-50/80 hover:text-amber-600",
      activeBg: "bg-amber-500 text-white shadow-md shadow-amber-55",
      badge: draftsCount,
    },
    {
      id: ActiveTab.HelpManual,
      title: "رہنمائی کتابچہ (Operating Guide)",
      icon: BookOpen,
      color: "text-slate-500",
      bg: "hover:bg-slate-100 hover:text-slate-800",
      activeBg: "bg-slate-700 text-white shadow-md shadow-slate-200",
    },
  ];

  return (
    <div className="w-full lg:w-72 bg-white border-l border-slate-200/95 flex flex-col h-full shrink-0 text-right" dir="rtl">
      
      {/* Brand logo display */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-start gap-3">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-xl shadow-md">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-base font-bold font-nastaleeq text-slate-800 tracking-tight leading-relaxed">
            اردو کمپوزر پرو
          </h2>
          <p className="text-[10px] text-slate-400 font-nastaleeq">تحریری و صوتی معاون پینل</p>
        </div>
      </div>

      {/* Nav list elements */}
      <nav className="flex-grow p-4 space-y-1.5 overflow-y-auto">
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
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="text-[10px] text-slate-400 font-nastaleeq leading-relaxed">
          عربی، اردو اور انگریزی آواز کی خودکار پبلشنگ گریڈ درستی کے لیے جیمنی 2.5 ٹیکنالوجی استعمال کی پبلش لیمٹیشن کا حصہ ہے۔
        </div>
      </div>

    </div>
  );
}

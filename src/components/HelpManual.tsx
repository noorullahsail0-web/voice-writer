/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, Mic, FileText, Check, HelpCircle, Share2, Clipboard, ShieldAlert } from "lucide-react";

export default function HelpManual() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-1 sm:p-4 text-right" dir="rtl">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-indigo-800 text-white p-8 rounded-2xl shadow-md border border-teal-650 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-nastaleeq font-bold leading-relaxed">رہنمائی اور استعمال کا طریقہ</h1>
          <p className="text-teal-50 max-w-xl text-base leading-relaxed">
            اردو وائس رائٹر اور پی ڈی ایف ایکسٹریکٹر کو نہایت مہارت اور تیزی سے پبلشنگ گریڈ کمپوزنگ کے لیے تیار کیا گیا ہے۔
          </p>
        </div>
        <div className="bg-white/10 p-4 rounded-full">
          <BookOpen className="w-16 h-16 text-teal-100" />
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice writer instructions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-teal-700">
            <div className="p-2 bg-teal-50 rounded-lg">
              <Mic className="w-6 h-6 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold font-nastaleeq leading-relaxed">1۔ آواز سے لکھنے کا طریقہ (وائس ٹائپنگ)</h2>
          </div>
          <p className="text-slate-650 text-sm leading-relaxed">
            کمپوزنگ کا طویل کام اب آپ صرف بول کر کر سکتے ہیں۔ ہماری ایپ ملٹی پل خودکار سروسز کے تحت چلتی ہے:
          </p>
          <ul className="space-y-2.5 text-xs text-slate-600 pr-2">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>رئیل ٹائم وائس (براہِ راست کمپیوٹر):</strong> مائیک آن کر کے مسلسل بولیں۔ یہ نظام آپ کے بولنے کے ساتھ ہی لائیو اسکرین پر الفاظ ٹائپ کرتا جائے گا۔</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>زبانوں کا انتخاب:</strong> ٹولز بار سے اردو، عربی یا انگریزی منتخب کریں۔ جب آپ کو اردو لکھنی ہو تو اردو، عربی کے لیے عربی اور انگلش کے لیے انگلش منتخب کریں۔</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>اعلیٰ حد تک باوثوق ٹرانسکرپشن (Gemini Voice):</strong> اگر آپ کی آواز میں شور ہو یا عام مائیک خراب ہو، تو آڈیو کلپ ریکارڈ کر کے جیمنی سروس کی مدد سے 100٪ درست تلفظ کا تحریری مسودہ حاصل کریں۔</span>
            </li>
          </ul>
        </div>

        {/* PDF Extractor Instructions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold font-nastaleeq leading-relaxed">2۔ خراب پی ڈی ایف سے تحریر نکالنا</h2>
          </div>
          <p className="text-slate-650 text-sm leading-relaxed">
            ناولز اور ڈائجسٹ جو اکثر کٹے پھٹے، اسکین شدہ یا خراب پی ڈی ایف کی شکل میں ہوتے ہیں، ان کو دوبارہ ٹائپ کرنے کی قطعا کوئی ضرورت نہیں:
          </p>
          <ul className="space-y-2.5 text-xs text-slate-600 pr-2">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>اعلیٰ بصری او سی آر (High-Fidelity OCR - جیمنی ٹیکنالوجی):</strong> یہ پی ڈی ایف کے ہر صفحہ کو ڈیجیٹل تصویر بنا کر جیمنی ماڈل کے پاس بھیجتا ہے۔ جیمنی ہر سیکنڈ میں دقیق نظر ڈال کر ہر حرف پڑھتا ہے اور خراب پرنٹ کی خودکار اصلاح کرتا ہے۔</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>واٹر مارک اور بارڈرز کا خاتمہ:</strong> جیمنی آرٹیفیشل انٹیلیجنس پی ڈی ایف کے اوپر موجود تمام غیر ضروری برانڈ لوگوز، ویب سائٹ لنکس، واٹر مارکس، چیپٹر پیجز نمبرز کو مکمل نظرانداز کر کے صرف اصل تحریر فلٹر کرتی ہے۔</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>سادہ ٹیکسٹ کا حصول:</strong> آپ کے پاس بغیر کسی فارمیٹنگ پیچیدگی کے صاف ستھرا سادہ ٹیکسٹ آ جائے گا، جس کو آپ ورڈ (.docx) میں آسانی سے پیسٹ کر سکتے ہیں۔</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Integration with external apps */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold font-nastaleeq text-slate-800 border-b pb-2 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-emerald-500" />
          واٹس ایپ، ای میل اور ایم ایس ورڈ (MS Word) میں منتقلی
        </h3>
        <p className="text-sm text-slate-650 leading-relaxed">
          ہماری ٹیمپلیٹ میں پبلشنگ کے روزمرہ ٹاسکس کو بہت آسان بنایا گیا ہے۔ لکھے گئے مواد کے بالکل نیچے کچھ فوری بٹن موجود ہیں:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#fbfcfa] p-4 rounded-xl border border-slate-150 space-y-1 shadow-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 justify-start">
              <Clipboard className="w-4 h-4 text-teal-600" />
              کلاؤڈ کاپی (Copy)
            </div>
            <p className="text-slate-500 leading-relaxed">پورے مواد کو صرف ایک کلک پر عارضی اسکرین کلپ بورڈ میں محفوظ کریں تاکہ ایم ایس ورڈ میں جا کر فائنل فارمیٹ کر سکیں ۔</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 justify-start">
              <Share2 className="w-4 h-4 text-emerald-500" />
              واٹس ایپ (WhatsApp)
            </div>
            <p className="text-slate-500 leading-relaxed">لکھے گئے مسودے کو براہِ راست اپنے من پسند دوستوں یا رائٹر گروپس میں واٹس ایپ کی مدد سے شیئر کریں۔</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5 justify-start">
              <BookOpen className="w-4 h-4 text-amber-500" />
              ورڈ فائل (.doc) ڈاؤن لوڈ
            </div>
            <p className="text-slate-500 leading-relaxed">پوری تحریر کو باقاعدہ مائیکروسافٹ آفس ورڈ میں براہِ راست اوپن ہونے والی فائل کے طور پر ڈاؤن لوڈ کریں تاکہ فائل محفوظ رہے۔</p>
          </div>
        </div>
      </div>

      {/* Advanced AI Text polisher */}
      <div className="bg-amber-50/50 border border-amber-200/70 p-6 rounded-2xl space-y-3">
        <h4 className="text-base font-bold font-nastaleeq text-amber-800 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          مصنفین کے لیے خودکار املا اور اعراب درستگی ٹول
        </h4>
        <p className="text-xs text-amber-700 leading-relaxed">
          آواز سے لکھتے وقت یا او سی آر کے بعد بعض حروف میں سپیس یا املا کی غلطیاں آ سکتی ہیں۔ اس مقصد کے لیے کی بورڈ کی بوریت سے بچانے کے لیے ہر ٹیکسٹ ونڈو پر <strong>"جیمنی املا اصلاح"</strong> اور <strong>"زير زبر پیش (اعراب) اضافہ"</strong> کے بٹن نصب ہیں۔ یہ فیچرز تحریر پر گہرا موازنہ کر کے خودکار اعراب لگاتے ہیں تاکہ پڑھنے میں ذرا سی تنگی نہ ہو۔
        </p>
      </div>

      {/* Error handling guide */}
      <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl flex items-start gap-4 text-right">
        <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0 mt-1" />
        <div className="space-y-1.5">
          <h4 className="text-sm font-semibold font-nastaleeq text-rose-800">مائیکروفون پرمیشن کی خرابی؟</h4>
          <p className="text-xs text-rose-700 leading-relaxed">
            اگر رئیل ٹائم وائس بٹن دبانے پر کچھ مائیکروفون کام نہ کرے، تو اطمینان رکھیے کہ آپ کے براؤزر نے مائیکروفون سروس کو بلاک کر دیا ہے۔ براؤزر کے اوپر ایڈریس بار پر لاک (Lock) کے آئیکن پر کلک کریں اور مائیکروفون کی اجازت (Allow Microphone) کو آن کریں، اور ایک بار صفحہ ریفریش کر لیں۔
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ActiveTab {
  VoiceComposer = "VOICE_COMPOSER",
  PdfExtractor = "PDF_EXTRACTOR",
  SavedDrafts = "SAVED_DRAFTS",
  HelpManual = "HELP_MANUAL",
}

export interface ComposerDraft {
  id: string;
  title: string;
  content: string;
  language: string;
  createdAt: string;
  lastModifiedAt: string;
}

export type NativeLanguage = "ur" | "ar" | "en";

export interface OcrPageProgress {
  pageNumber: number;
  status: "pending" | "processing" | "success" | "failed";
  extractedText?: string;
  errorMessage?: string;
}

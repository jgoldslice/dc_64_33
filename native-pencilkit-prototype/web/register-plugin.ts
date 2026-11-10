/* Integration example for the native Capacitor/iOS wrapper build.
   This is NOT a browser-ready script and must not be added to index.html until
   an actual bundler or equivalent registration step is configured. */
import { registerPlugin } from '@capacitor/core';

export type NativePageMetadata = {
  schemaVersion: 1;
  projectId: string;
  pageId: string;
  pageWidth: number;
  pageHeight: number;
  drawingSHA256: string;
  previewSHA256: string;
  savedAt: string;
};

export type NativePagePayload = NativePageMetadata & {
  format: 'blueprint-pencilkit-page';
  drawingBase64: string;
  previewBase64: string;
  previewMIME: 'image/png';
};

export interface BlueprintPencilPlugin {
  capabilities(): Promise<{available: boolean; schemaVersion: number; format: string;
    pageWidth: number; pageHeight: number}>;
  openEditor(options: {projectId: string; pageId: string; pageIds: string[]}):
    Promise<NativePageMetadata>;
  exportPage(options: {projectId: string; pageId: string}):
    Promise<NativePagePayload>;
  importPage(options: {projectId: string; pageId: string; payload: NativePagePayload;
    allowOverwrite?: boolean}): Promise<NativePageMetadata>;
}

export const BlueprintPencil =
  registerPlugin<BlueprintPencilPlugin>('BlueprintPencil');

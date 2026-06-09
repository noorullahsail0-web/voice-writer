import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// Polyfill Promise.try for environments/browsers lacking native support
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

// Polyfill Uint8Array.prototype.toHex, toBase64 and fromBase64 for environments/browsers lacking native support
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function (): string {
    let hex = "";
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, "0");
    }
    return hex;
  };
}

if (typeof (Uint8Array.prototype as any).toBase64 !== 'function') {
  (Uint8Array.prototype as any).toBase64 = function (): string {
    let binary = "";
    const len = this.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(this[i]);
    }
    return btoa(binary);
  };
}

if (typeof (Uint8Array as any).fromBase64 !== 'function') {
  (Uint8Array as any).fromBase64 = function (base64String: string): Uint8Array {
    const binary = atob(base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };
}

if (typeof (Uint8Array as any).fromHex !== 'function') {
  (Uint8Array as any).fromHex = function (hexString: string): Uint8Array {
    if (hexString.length % 2 !== 0) {
      throw new Error('Invalid hex string');
    }
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexString.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };
}

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Binary Data Utilities
 * Support for ArrayBuffer and Blob data transfer
 */

export interface BinaryMessage {
  type: "binary";
  encoding: "base64" | "arraybuffer";
  mimeType?: string;
  data: string;
  size: number;
}

// Convert ArrayBuffer to base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert Blob to base64
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert base64 to Blob
export function base64ToBlob(base64: string, mimeType: string = "application/octet-stream"): Blob {
  const buffer = base64ToArrayBuffer(base64);
  return new Blob([buffer], { type: mimeType });
}

// Encode binary data for transport
export async function encodeBinaryData(
  data: ArrayBuffer | Blob | Uint8Array
): Promise<BinaryMessage> {
  let base64: string;
  let mimeType: string | undefined;
  let size: number;

  if (data instanceof Blob) {
    base64 = await blobToBase64(data);
    mimeType = data.type;
    size = data.size;
  } else if (data instanceof Uint8Array) {
    base64 = arrayBufferToBase64(data.buffer as ArrayBuffer);
    size = data.byteLength;
  } else {
    // ArrayBuffer
    base64 = arrayBufferToBase64(data as ArrayBuffer);
    size = data.byteLength;
  }

  return {
    type: "binary",
    encoding: "base64",
    mimeType,
    data: base64,
    size,
  };
}

// Decode binary message back to original format
export function decodeBinaryData(message: BinaryMessage): ArrayBuffer {
  return base64ToArrayBuffer(message.data);
}

// Check if data is binary
export function isBinaryData(data: unknown): boolean {
  return (
    data instanceof ArrayBuffer ||
    data instanceof Blob ||
    data instanceof Uint8Array ||
    (typeof data === "object" && data !== null && (data as BinaryMessage).type === "binary")
  );
}

// Chunk large binary data for streaming
export function* chunkBinaryData(
  buffer: ArrayBuffer,
  chunkSize: number = 64 * 1024 // 64KB chunks
): Generator<ArrayBuffer> {
  const totalSize = buffer.byteLength;
  let offset = 0;

  while (offset < totalSize) {
    const end = Math.min(offset + chunkSize, totalSize);
    yield buffer.slice(offset, end);
    offset = end;
  }
}

// Reassemble chunked binary data
export function reassembleChunks(chunks: ArrayBuffer[]): ArrayBuffer {
  const totalSize = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  return result.buffer;
}

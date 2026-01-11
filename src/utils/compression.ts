/**
 * Message Compression Utilities
 * Reduces bandwidth for large payloads
 */

// Browser-compatible compression using CompressionStream API
export async function compressMessage(data: string): Promise<string> {
  if (typeof CompressionStream === "undefined") {
    // Fallback: return base64 encoded
    return btoa(data);
  }

  const encoder = new TextEncoder();
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  
  writer.write(encoder.encode(data));
  writer.close();

  const compressedChunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }

  // Combine chunks and convert to base64
  const totalLength = compressedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of compressedChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return btoa(String.fromCharCode(...combined));
}

export async function decompressMessage(compressed: string): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    // Fallback: return base64 decoded
    return atob(compressed);
  }

  const binaryString = atob(compressed);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  
  writer.write(bytes);
  writer.close();

  const decompressedChunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    decompressedChunks.push(value);
  }

  const decoder = new TextDecoder();
  return decompressedChunks.map(chunk => decoder.decode(chunk)).join("");
}

// Simple compression threshold (compress if > 1KB)
export const COMPRESSION_THRESHOLD = 1024;

export function shouldCompress(data: string): boolean {
  return data.length > COMPRESSION_THRESHOLD;
}

// Node.js compatible compression (for server-side)
export async function compressMessageNode(data: string): Promise<Buffer> {
  const { promisify } = await import("util");
  const { gzip } = await import("zlib");
  const gzipAsync = promisify(gzip);
  return await gzipAsync(Buffer.from(data));
}

export async function decompressMessageNode(compressed: Buffer): Promise<string> {
  const { promisify } = await import("util");
  const { gunzip } = await import("zlib");
  const gunzipAsync = promisify(gunzip);
  const decompressed = await gunzipAsync(compressed);
  return decompressed.toString();
}

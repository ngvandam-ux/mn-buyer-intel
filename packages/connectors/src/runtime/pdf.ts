import { extractText, getDocumentProxy } from 'unpdf';

/** Extract plain text from PDF bytes (serverless pdfjs, no canvas/native deps). */
export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  return { text: Array.isArray(text) ? text.join('\n') : text, pages: totalPages };
}

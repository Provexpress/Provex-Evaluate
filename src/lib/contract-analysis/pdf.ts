import pdfParse from "pdf-parse";

export async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  const result = await pdfParse(fileBuffer);
  return result.text ?? "";
}

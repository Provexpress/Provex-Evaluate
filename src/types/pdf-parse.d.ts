declare module "pdf-parse" {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    text: string;
    version: string;
  }

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PdfParseResult>;
}

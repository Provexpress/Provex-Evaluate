import { NextRequest, NextResponse } from "next/server";

import {
  analyzeContractWithAi,
  AiConfigurationError
} from "@/lib/contract-analysis/aiClient";
import {
  enforceBusinessRules,
  parseNumberLike,
  type BusinessInputs
} from "@/lib/contract-analysis/business";
import { extractPdfText } from "@/lib/contract-analysis/pdf";
import { cleanContractText, prepareContractTextForAi } from "@/lib/contract-analysis/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function POST(request: NextRequest) {
  try {
    assertMultipart(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!isFileLike(file)) {
      throw new HttpError(400, "missing_file", "Upload a PDF file in the 'file' field.");
    }

    validatePdfFile(file);

    const businessInputs = readBusinessInputs(formData);
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractPdfText(buffer);
    const cleanText = cleanContractText(rawText);

    if (!cleanText) {
      throw new HttpError(422, "empty_pdf_text", "No extractable text was found in the PDF.");
    }

    const preparedText = prepareContractTextForAi(
      cleanText,
      envNumber("CONTRACT_TEXT_MAX_CHARS", 65000)
    );
    const aiAnalysis = await analyzeContractWithAi({ preparedText, businessInputs });
    const finalAnalysis = enforceBusinessRules(aiAnalysis, businessInputs);

    return NextResponse.json(finalAnalysis, { status: 200 });
  } catch (error) {
    return handleError(error);
  }
}

function assertMultipart(request: NextRequest): void {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(
      415,
      "invalid_content_type",
      "Use multipart/form-data with a PDF file field named 'file'."
    );
  }
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}

function validatePdfFile(file: File): void {
  const maxBytes = envNumber("MAX_CONTRACT_FILE_MB", 20) * 1024 * 1024;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (!name.endsWith(".pdf") && type !== "application/pdf") {
    throw new HttpError(400, "invalid_file_type", "Only PDF files are supported.");
  }

  if (file.size <= 0) {
    throw new HttpError(400, "empty_file", "The uploaded file is empty.");
  }

  if (file.size > maxBytes) {
    throw new HttpError(
      413,
      "file_too_large",
      `PDF exceeds the ${envNumber("MAX_CONTRACT_FILE_MB", 20)} MB limit.`
    );
  }
}

function readBusinessInputs(formData: FormData): BusinessInputs {
  const fromJson = readBusinessInputsJson(formData.get("business_inputs"));

  return {
    estimated_cost:
      readOptionalNumber(formData.get("estimated_cost"), "estimated_cost") ??
      fromJson.estimated_cost,
    expected_margin:
      readOptionalNumber(formData.get("expected_margin"), "expected_margin") ??
      fromJson.expected_margin
  };
}

function readBusinessInputsJson(value: FormDataEntryValue | null): BusinessInputs {
  if (value === null || value === "") {
    return {};
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_business_inputs", "business_inputs must be JSON text.");
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed)) {
      throw new HttpError(400, "invalid_business_inputs", "business_inputs must be a JSON object.");
    }

    return {
      estimated_cost:
        typeof parsed.estimated_cost === "number"
          ? parsed.estimated_cost
          : typeof parsed.estimated_cost === "string"
            ? parseRequiredNumber(parsed.estimated_cost, "business_inputs.estimated_cost")
            : undefined,
      expected_margin:
        typeof parsed.expected_margin === "number"
          ? parsed.expected_margin
          : typeof parsed.expected_margin === "string"
            ? parseRequiredNumber(parsed.expected_margin, "business_inputs.expected_margin")
            : undefined
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(400, "invalid_business_inputs", "business_inputs must be valid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readOptionalNumber(
  value: FormDataEntryValue | null,
  fieldName: string
): number | undefined {
  if (value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_number", `${fieldName} must be a number.`);
  }

  return parseRequiredNumber(value, fieldName);
}

function parseRequiredNumber(value: string, fieldName: string): number {
  const parsed = parseNumberLike(value);

  if (parsed === null || !Number.isFinite(parsed)) {
    throw new HttpError(400, "invalid_number", `${fieldName} must be a valid number.`);
  }

  return parsed;
}

function envNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  if (error instanceof AiConfigurationError) {
    return NextResponse.json(
      {
        error: {
          code: "ai_configuration_error",
          message: error.message
        }
      },
      { status: 500 }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json(
    {
      error: {
        code: "contract_analysis_failed",
        message
      }
    },
    { status: 500 }
  );
}

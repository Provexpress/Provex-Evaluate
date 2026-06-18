# ProvexEvaluate

Backend API for PDF contract analysis from the contractor business perspective.

## Endpoint

`POST /analyze-contract`

The Next.js route also exists at `/api/analyze-contract`; `next.config.mjs` rewrites `/analyze-contract` to the API route.

## Local setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and set either OpenAI direct credentials or Azure OpenAI credentials.

This project uses the same variable names as `Provex Assitant`:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

or:

```bash
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-10-21
```

## Example request

```bash
curl -X POST http://localhost:3000/analyze-contract \
  -F "file=@./contracts/example.pdf" \
  -F "estimated_cost=50000000" \
  -F "expected_margin=18"
```

You can also send the business inputs as JSON:

```bash
curl -X POST http://localhost:3000/analyze-contract \
  -F "file=@./contracts/example.pdf" \
  -F 'business_inputs={"estimated_cost":50000000,"expected_margin":18}'
```

## Example response

```json
{
  "data": {
    "parties": {
      "contractor": "Provexpress SAS",
      "client": "ACME SAS"
    },
    "value": "COP 120,000,000",
    "currency": "COP",
    "TRM": "",
    "duration": "12 months",
    "payment_terms": "Monthly payment after client approval of invoices.",
    "policies": "Contractor must provide compliance and civil liability policies.",
    "penalties": "Penalty of 10% for breach or delay.",
    "termination": "Client may terminate unilaterally with prior notice."
  },
  "analysis": {
    "profitability": "medium",
    "risk": "high",
    "cash_flow": "weak",
    "key_issues": [
      "Payment depends on approval or acceptance; cash flow is weaker.",
      "Termination appears unilateral; contractor continuity risk is high."
    ]
  },
  "decision": {
    "recommendation": "conditional",
    "reason": "Payment depends on approval or acceptance; cash flow is weaker. Termination appears unilateral; contractor continuity risk is high."
  }
}
```

## Implementation notes

- PDF extraction: `pdf-parse`
- Text cleanup and ranked chunking: `src/lib/contract-analysis/text.ts`
- AI call: OpenAI or Azure OpenAI chat completions through environment variables
- Deterministic CFO rules: `src/lib/contract-analysis/business.ts`
- Internal profitability helper: `evaluateBusinessInputs({ estimated_cost, expected_margin })`

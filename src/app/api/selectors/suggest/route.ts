import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeSecrets } from "@/lib/workflow-schema";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI();

// Schema for input validation
const InputSchema = z.object({
  htmlSnippet: z.string().min(1).max(500000), // Max 500KB input size limit
  targetElementDescription: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  try {
    // 1. Authenticate user
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;
    const { dbUserId } = authResult;

    // 2. Rate limit (5 requests per minute for AI selector gen)
    const limitResult = await rateLimit({
      key: `selector-gen:${dbUserId}`,
      limit: 5,
      durationSeconds: 60,
    });

    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // 3. Enforce request body size limit at NextJS level
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 600 * 1024) { // 600KB max payload
      return NextResponse.json(
        { error: "Payload too large. Maximum size is 600KB." },
        { status: 413 }
      );
    }

    // 4. Parse & Validate request body
    const body = await req.json();
    const parseResult = InputSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input parameters", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    let { htmlSnippet, targetElementDescription } = parseResult.data;

    // 5. Truncate snippet to protect context window and costs (e.g., max 25,000 chars)
    if (htmlSnippet.length > 25000) {
      htmlSnippet = htmlSnippet.slice(0, 25000) + "\n<!-- [Truncated due to size limits] -->";
    }

    // 6. Call OpenAI gpt-4o-mini for selector suggestion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert Playwright automation engineer. 
Your task is to analyze HTML snippets and generate robust, multi-vector selectors for the requested element.
Return the result strictly as a JSON object matching this schema:
{
  "primary": "string (best id, data-testid, or robust css)",
  "css": "string (pure CSS selector as fallback)",
  "text": "string (visible text content if applicable, else null)",
  "testId": "string (data-testid if present, else null)",
  "ariaLabel": "string (aria-label if present, else null)"
}
Do not include markdown blocks, just the JSON.`,
        },
        {
          role: "user",
          content: `Target Element: ${targetElementDescription}\n\nHTML Context:\n${htmlSnippet}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const resultText = completion.choices[0].message.content;
    if (!resultText) {
      throw new Error("Empty response from OpenAI");
    }

    const suggestions = JSON.parse(resultText);

    // 7. Redact any potential secrets from the returned suggestions
    const sanitizedSuggestions = {
      primary: sanitizeSecrets(suggestions.primary || ""),
      css: sanitizeSecrets(suggestions.css || ""),
      text: suggestions.text ? sanitizeSecrets(suggestions.text) : null,
      testId: suggestions.testId ? sanitizeSecrets(suggestions.testId) : null,
      ariaLabel: suggestions.ariaLabel ? sanitizeSecrets(suggestions.ariaLabel) : null,
    };

    // Logging only metadata, excluding the HTML snippet (privacy/PII control)
    console.log(`[AI Selector] Generated for user ${dbUserId}, length: ${htmlSnippet.length}, target: ${targetElementDescription.slice(0, 50)}`);

    return NextResponse.json({ success: true, selectors: sanitizedSuggestions });
  } catch (error: any) {
    // Redact error messages from logs/payload
    const safeMsg = sanitizeSecrets(error?.message || "Internal server error");
    console.error("Error generating selector with OpenAI:", safeMsg);
    return NextResponse.json(
      { error: "Failed to generate selector. Please check inputs and try again." },
      { status: 500 }
    );
  }
}


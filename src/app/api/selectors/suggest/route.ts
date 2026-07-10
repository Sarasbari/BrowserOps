import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

// Initialize OpenAI client
// Expects OPENAI_API_KEY environment variable
const openai = new OpenAI();

export async function POST(req: Request) {
  try {
    // 1. Authenticate user via Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { htmlSnippet, targetElementDescription } = body;

    if (!htmlSnippet || !targetElementDescription) {
      return NextResponse.json(
        { error: "Missing htmlSnippet or targetElementDescription" },
        { status: 400 }
      );
    }

    // 3. Call OpenAI for selector suggestion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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

    return NextResponse.json({ success: true, selectors: suggestions });
  } catch (error) {
    console.error("Error generating selector with OpenAI:", error);
    return NextResponse.json(
      { error: "Failed to generate selector" },
      { status: 500 }
    );
  }
}

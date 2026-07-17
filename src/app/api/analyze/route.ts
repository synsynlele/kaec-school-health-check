import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const prompt = `
You are an experienced school transformation consultant.

Analyze this school assessment.

${JSON.stringify(body, null, 2)}

Produce:

1. Executive Summary
2. Overall School Health Score (0–100)
3. Five Strengths
4. Five Weaknesses
5. Priority Areas
6. 90-Day Improvement Plan
7. Practical recommendations for the school leader.

Return the response in Markdown.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return NextResponse.json({
    report: response.text,
  });
}
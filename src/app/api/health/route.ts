import { NextResponse } from "next/server";
import {
  generateReport,
  openAiConfigurationStatus,
  probeOpenAiConnection,
} from "@/lib/kshc-ai-report";
import { QUESTIONS, RATING_OPTIONS } from "@/lib/questions";
import { storageBackend } from "@/lib/storage";
import type { AnswerRecord, SchoolInfo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function syntheticAssessment(): { school: SchoolInfo; answers: AnswerRecord[] } {
  const now = new Date().toISOString();
  const school: SchoolInfo = {
    id: "00000000-0000-4000-8000-000000000001",
    schoolName: "KSHC AI Pipeline Probe School",
    contactName: "KSHC System Probe",
    email: "probe@example.invalid",
    phone: "",
    state: "Lagos",
    country: "Nigeria",
    schoolType: "Secondary School",
    schoolLevel: "All Levels",
    studentPopulation: "100 – 299",
    staffPopulation: "20 – 49",
    assessmentDate: now,
    createdAt: now,
  };
  const answers: AnswerRecord[] = QUESTIONS.map((question, index) => {
    const score = ((index * 7) % 5) + 1;
    return {
      questionId: question.id,
      chapter: question.chapter,
      score,
      answer: RATING_OPTIONS.find((option) => option.value === score)?.label ?? "",
    };
  });
  return { school, answers };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsProbe = url.searchParams.get("probe") === "1";
  const wantsReportProbe = url.searchParams.get("reportProbe") === "1";
  const ai = openAiConfigurationStatus();
  const previewOnly = process.env.VERCEL_ENV !== "production";

  if (wantsReportProbe && previewOnly) {
    const fixture = syntheticAssessment();
    const report = await generateReport(fixture.school, fixture.answers);
    const passed = report.engine === "openai" && report.generation?.aiStatus === "openai_success";
    return NextResponse.json(
      {
        ok: passed,
        service: "kaec-school-health-check",
        backend: storageBackend(),
        reportProbe: {
          engine: report.engine,
          generation: report.generation ?? null,
          counts: {
            strengths: report.strengths.length,
            weaknesses: report.weaknesses.length,
            recommendations: report.recommendations.length,
            quickWins: report.quickWins.length,
            plan30: report.plan30.length,
            plan60: report.plan60.length,
            plan90: report.plan90.length,
            chapterAnalyses: report.chapterAnalyses.length,
          },
        },
        time: new Date().toISOString(),
      },
      {
        status: passed ? 200 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (wantsProbe && previewOnly) {
    const probe = await probeOpenAiConnection();
    return NextResponse.json(
      {
        ok: probe.ok,
        service: "kaec-school-health-check",
        backend: storageBackend(),
        ai: probe,
        time: new Date().toISOString(),
      },
      {
        status: probe.ok ? 200 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      service: "kaec-school-health-check",
      backend: storageBackend(),
      ai,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

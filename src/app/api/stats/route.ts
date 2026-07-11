/**
 * BrowserOps — Dashboard Stats API
 * GET /api/stats — Aggregate stats for the command center
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";

export async function GET() {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;
  const { dbUserId } = authResult;

  // Run all queries in parallel
  const [
    totalWorkflows,
    activeWorkflows,
    totalRuns,
    runsByStatus,
    recentRuns,
    totalBrowserMinutes,
    selfHealedSteps,
    totalSteps,
    activeSchedules,
  ] = await Promise.all([
    // Total workflows
    prisma.workflow.count({ where: { userId: dbUserId } }),

    // Active (published) workflows
    prisma.workflow.count({
      where: { userId: dbUserId, status: "PUBLISHED" },
    }),

    // Total runs
    prisma.workflowRun.count({
      where: { version: { workflow: { userId: dbUserId } } },
    }),

    // Runs grouped by status
    prisma.workflowRun.groupBy({
      by: ["status"],
      where: { version: { workflow: { userId: dbUserId } } },
      _count: true,
    }),

    // Recent 5 runs
    prisma.workflowRun.findMany({
      where: { version: { workflow: { userId: dbUserId } } },
      include: {
        version: {
          select: {
            version: true,
            workflow: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Total browser minutes used
    prisma.workflowRun.aggregate({
      where: {
        version: { workflow: { userId: dbUserId } },
        browserMinutes: { not: null },
      },
      _sum: { browserMinutes: true },
    }),

    // Self-healed step count
    prisma.runStepLog.count({
      where: {
        selfHealed: true,
        run: { version: { workflow: { userId: dbUserId } } },
      },
    }),

    // Total steps executed
    prisma.runStepLog.count({
      where: {
        run: { version: { workflow: { userId: dbUserId } } },
      },
    }),

    // Active schedules
    prisma.schedule.count({
      where: {
        isActive: true,
        workflow: { userId: dbUserId },
      },
    }),
  ]);

  // Build status breakdown
  const statusMap: Record<string, number> = {};
  for (const group of runsByStatus) {
    statusMap[group.status] = group._count;
  }

  // Success rate
  const completedRuns = statusMap["COMPLETED"] || 0;
  const failedRuns = statusMap["FAILED"] || 0;
  const finishedRuns = completedRuns + failedRuns;
  const successRate = finishedRuns > 0 ? (completedRuns / finishedRuns) * 100 : 100;

  // Self-healing rate
  const healingRate =
    totalSteps > 0 ? (selfHealedSteps / totalSteps) * 100 : 0;

  return NextResponse.json({
    workflows: {
      total: totalWorkflows,
      active: activeWorkflows,
    },
    runs: {
      total: totalRuns,
      byStatus: statusMap,
      successRate: Math.round(successRate * 10) / 10,
      recent: recentRuns,
    },
    usage: {
      browserMinutes: Math.round(
        (totalBrowserMinutes._sum.browserMinutes || 0) * 100
      ) / 100,
    },
    selfHealing: {
      healed: selfHealedSteps,
      total: totalSteps,
      rate: Math.round(healingRate * 10) / 10,
    },
    schedules: {
      active: activeSchedules,
    },
  });
}

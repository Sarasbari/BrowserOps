import { z } from "zod";

// ── Zod Schemas for API Responses ──

export const StatsResponseSchema = z.object({
  workflows: z.object({
    total: z.number(),
    active: z.number(),
  }),
  runs: z.object({
    total: z.number(),
    byStatus: z.record(z.string(), z.number()),
    successRate: z.number(),
    recent: z.array(z.any()), // Can be typed stricter if needed
  }),
  usage: z.object({
    browserMinutes: z.number(),
  }),
  selfHealing: z.object({
    healed: z.number(),
    total: z.number(),
    rate: z.number(),
  }),
  schedules: z.object({
    active: z.number(),
  }),
});

export const WorkflowsResponseSchema = z.object({
  workflows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
      createdAt: z.string(),
      updatedAt: z.string(),
      _count: z.object({
        versions: z.number(),
        runs: z.number(),
      }),
      versions: z.array(z.any()).optional(),
    })
  ),
});

export const RunsResponseSchema = z.object({
  runs: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["QUEUED", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"]),
      versionId: z.string(),
      jobId: z.string().nullable(),
      startedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
      durationMs: z.number().nullable(),
      failureReason: z.string().nullable(),
      browserMinutes: z.number().nullable(),
      createdAt: z.string(),
      version: z.object({
        id: z.string(),
        version: z.number(),
        workflow: z.object({
          id: z.string(),
          name: z.string(),
        }),
      }),
      _count: z.object({
        stepLogs: z.number(),
      }),
    })
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    pages: z.number(),
  }),
});

export const CredentialsResponseSchema = z.object({
  credentials: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      _count: z.object({
        usedBy: z.number().optional(), // If not available, we won't strictly require it
      }).optional(),
    })
  ),
});

export const SchedulesResponseSchema = z.object({
  schedules: z.array(
    z.object({
      id: z.string(),
      workflowId: z.string(),
      cronExpr: z.string(),
      timezone: z.string(),
      isActive: z.boolean(),
      lastRunAt: z.string().nullable(),
      nextRunAt: z.string().nullable(),
      createdAt: z.string(),
      workflow: z.object({
        name: z.string(),
      }),
    })
  ),
});

// ── Generic Typed Fetcher ──

export class APIError extends Error {
  public status: number;
  public info: any;

  constructor(message: string, status: number, info: any) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

/**
 * A typed fetcher for SWR. Validates the response against a Zod schema.
 */
export async function typedFetch<T>(
  url: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    const errorInfo = await res.json().catch(() => ({}));
    throw new APIError(
      errorInfo.error || "An error occurred while fetching the data.",
      res.status,
      errorInfo
    );
  }

  const data = await res.json();
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    console.error("API response schema validation failed:", parsed.error);
    throw new Error("Invalid API response format");
  }

  return parsed.data;
}

// ── Pre-bound Fetchers for SWR ──
// Use these in useSWR like: useSWR('/api/stats', fetchStats)

export const fetchStats = (url: string) => typedFetch(url, StatsResponseSchema);
export const fetchWorkflows = (url: string) => typedFetch(url, WorkflowsResponseSchema);
export const fetchRuns = (url: string) => typedFetch(url, RunsResponseSchema);
export const fetchCredentials = (url: string) => typedFetch(url, CredentialsResponseSchema);
export const fetchSchedules = (url: string) => typedFetch(url, SchedulesResponseSchema);

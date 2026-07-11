/**
 * BrowserOps — Workflow Step Schema (Zod)
 * ════════════════════════════════════════
 * Single source of truth for step types and their configs.
 * Shared by: builder, API routes, and executor.
 */
import { z } from "zod/v4";

// ── Step Type Enum ──

export const STEP_TYPES = [
  "open_url",
  "click_element",
  "type_text",
  "wait_for_selector",
  "extract_text",
  "extract_table",
  "download_file",
  "upload_file",
  "save_output",
  "human_intervention",
] as const;

export const StepTypeEnum = z.enum(STEP_TYPES);
export type StepType = z.infer<typeof StepTypeEnum>;

// ── Multi-Vector Selector ──

export const MultiVectorSelectorSchema = z.object({
  primary: z.string().min(1),
  text: z.string().optional(),
  css: z.string().optional(),
  ariaLabel: z.string().optional(),
  testId: z.string().optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export type MultiVectorSelectorInput = z.infer<typeof MultiVectorSelectorSchema>;

// ── Per-Type Step Schemas (discriminated union on `type`) ──

const BaseStep = {
  label: z.string().min(1),
};

const OpenUrlStepSchema = z.object({
  ...BaseStep,
  type: z.literal("open_url"),
  config: z.object({
    url: z.string().min(1),
    timeout: z.number().int().positive().optional(),
  }),
});

const ClickElementStepSchema = z.object({
  ...BaseStep,
  type: z.literal("click_element"),
  config: z.object({
    selectors: MultiVectorSelectorSchema,
    timeout: z.number().int().positive().optional(),
  }),
});

const TypeTextStepSchema = z.object({
  ...BaseStep,
  type: z.literal("type_text"),
  config: z.object({
    selectors: MultiVectorSelectorSchema,
    text: z.string(),
    timeout: z.number().int().positive().optional(),
    credentialId: z.string().optional(),
  }),
});

const WaitForSelectorStepSchema = z.object({
  ...BaseStep,
  type: z.literal("wait_for_selector"),
  config: z.object({
    selectors: MultiVectorSelectorSchema,
    timeout: z.number().int().positive().optional(),
  }),
});

const ExtractTextStepSchema = z.object({
  ...BaseStep,
  type: z.literal("extract_text"),
  config: z.object({
    selectors: MultiVectorSelectorSchema,
    outputKey: z.string().optional(),
    timeout: z.number().int().positive().optional(),
  }),
});

const ExtractTableStepSchema = z.object({
  ...BaseStep,
  type: z.literal("extract_table"),
  config: z.object({
    selectors: MultiVectorSelectorSchema,
    outputKey: z.string().optional(),
    timeout: z.number().int().positive().optional(),
  }),
});

const DownloadFileStepSchema = z.object({
  ...BaseStep,
  type: z.literal("download_file"),
  config: z.object({
    selectors: MultiVectorSelectorSchema.optional(),
    url: z.string().optional(),
    outputKey: z.string().optional(),
    timeout: z.number().int().positive().optional(),
  }),
});

const UploadFileStepSchema = z.object({
  ...BaseStep,
  type: z.literal("upload_file"),
  config: z.object({
    selectors: MultiVectorSelectorSchema,
    text: z.string().optional(), // file path
    timeout: z.number().int().positive().optional(),
  }),
});

const SaveOutputStepSchema = z.object({
  ...BaseStep,
  type: z.literal("save_output"),
  config: z.object({
    outputKey: z.string().optional(),
    format: z.string().optional(),
    filename: z.string().optional(),
  }),
});

const HumanInterventionStepSchema = z.object({
  ...BaseStep,
  type: z.literal("human_intervention"),
  config: z.object({
    waitMs: z.number().int().positive().optional(),
    timeout: z.number().int().positive().optional(),
    message: z.string().optional(),
  }),
});

// ── Discriminated Union ──

export const WorkflowStepSchema = z.discriminatedUnion("type", [
  OpenUrlStepSchema,
  ClickElementStepSchema,
  TypeTextStepSchema,
  WaitForSelectorStepSchema,
  ExtractTextStepSchema,
  ExtractTableStepSchema,
  DownloadFileStepSchema,
  UploadFileStepSchema,
  SaveOutputStepSchema,
  HumanInterventionStepSchema,
]);

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// ── Steps Array ──

export const WorkflowStepsSchema = z.array(WorkflowStepSchema).min(1, {
  message: "Workflow must have at least one step",
});

export type WorkflowSteps = z.infer<typeof WorkflowStepsSchema>;

// ── Convenience Parser ──

export function parseWorkflowSteps(data: unknown): {
  success: boolean;
  data?: WorkflowSteps;
  error?: string;
} {
  const result = WorkflowStepsSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Format Zod v4 errors into a readable message
  const formatted = z.prettifyError(result.error);
  return { success: false, error: formatted };
}

// ── Secret Sanitizer ──

const SECRET_PATTERNS = [
  /password\s*[:=]\s*\S+/gi,
  /secret\s*[:=]\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /token\s*[:=]\s*\S+/gi,
  /bearer\s+\S+/gi,
  /{{credentials\.[^}]+}}/gi,
];

/**
 * Removes potentially sensitive values from error messages and log output.
 */
export function sanitizeSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

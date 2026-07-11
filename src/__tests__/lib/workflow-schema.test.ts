/**
 * BrowserOps — Workflow Schema Tests
 * ═══════════════════════════════════
 * Tests Zod validation of workflow steps.
 */
import { describe, it, expect } from "vitest";
import {
  parseWorkflowSteps,
  WorkflowStepsSchema,
  sanitizeSecrets,
} from "@/lib/workflow-schema";

describe("WorkflowStepsSchema", () => {
  // ── Valid steps ──

  it("accepts a valid single open_url step", () => {
    const result = parseWorkflowSteps([
      { type: "open_url", label: "Go to site", config: { url: "https://example.com" } },
    ]);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].type).toBe("open_url");
  });

  it("accepts a valid multi-step workflow", () => {
    const steps = [
      { type: "open_url", label: "Navigate", config: { url: "https://example.com" } },
      {
        type: "click_element",
        label: "Click Login",
        config: {
          selectors: { primary: "#login-btn", text: "Login" },
        },
      },
      {
        type: "type_text",
        label: "Enter Email",
        config: {
          selectors: { primary: "#email" },
          text: "user@test.com",
        },
      },
      {
        type: "extract_text",
        label: "Get Welcome",
        config: {
          selectors: { primary: ".welcome" },
          outputKey: "greeting",
        },
      },
      {
        type: "save_output",
        label: "Save Data",
        config: { outputKey: "result" },
      },
    ];

    const result = parseWorkflowSteps(steps);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(5);
  });

  it("accepts all 10 step types with valid configs", () => {
    const steps = [
      { type: "open_url", label: "Open", config: { url: "https://a.com" } },
      { type: "click_element", label: "Click", config: { selectors: { primary: "#btn" } } },
      { type: "type_text", label: "Type", config: { selectors: { primary: "#input" }, text: "hello" } },
      { type: "wait_for_selector", label: "Wait", config: { selectors: { primary: ".loaded" } } },
      { type: "extract_text", label: "Extract", config: { selectors: { primary: ".data" } } },
      { type: "extract_table", label: "Table", config: { selectors: { primary: "table" } } },
      { type: "download_file", label: "Download", config: {} },
      { type: "upload_file", label: "Upload", config: { selectors: { primary: "input[type=file]" } } },
      { type: "save_output", label: "Save", config: {} },
      { type: "human_intervention", label: "Pause", config: {} },
    ];

    const result = parseWorkflowSteps(steps);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(10);
  });

  it("accepts optional timeout on steps", () => {
    const result = parseWorkflowSteps([
      { type: "open_url", label: "Open", config: { url: "https://a.com", timeout: 5000 } },
    ]);
    expect(result.success).toBe(true);
    expect((result.data![0].config as { timeout?: number }).timeout).toBe(5000);
  });

  // ── Rejection: unknown step types ──

  it("rejects unknown step type", () => {
    const result = parseWorkflowSteps([
      { type: "fly_to_moon", label: "Fly", config: {} },
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ── Rejection: missing required fields ──

  it("rejects open_url without url", () => {
    const result = parseWorkflowSteps([
      { type: "open_url", label: "Open", config: {} },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects click_element without selectors", () => {
    const result = parseWorkflowSteps([
      { type: "click_element", label: "Click", config: {} },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects type_text without text", () => {
    const result = parseWorkflowSteps([
      {
        type: "type_text",
        label: "Type",
        config: { selectors: { primary: "#input" } },
      },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects step without label", () => {
    const result = parseWorkflowSteps([
      { type: "open_url", config: { url: "https://a.com" } },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = parseWorkflowSteps([
      { type: "open_url", label: "", config: { url: "https://a.com" } },
    ]);
    expect(result.success).toBe(false);
  });

  // ── Rejection: empty array ──

  it("rejects empty steps array", () => {
    const result = parseWorkflowSteps([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain("at least one step");
  });

  // ── Rejection: not an array ──

  it("rejects non-array input", () => {
    const result = parseWorkflowSteps("not an array");
    expect(result.success).toBe(false);
  });

  it("rejects null input", () => {
    const result = parseWorkflowSteps(null);
    expect(result.success).toBe(false);
  });

  // ── Selector validation ──

  it("rejects empty primary selector", () => {
    const result = parseWorkflowSteps([
      {
        type: "click_element",
        label: "Click",
        config: { selectors: { primary: "" } },
      },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("sanitizeSecrets", () => {
  it("redacts password patterns", () => {
    expect(sanitizeSecrets("password: mysecret123")).toBe("[REDACTED]");
  });

  it("redacts API key patterns", () => {
    expect(sanitizeSecrets("api_key=sk-1234567890")).toBe("[REDACTED]");
  });

  it("redacts credential template references", () => {
    expect(sanitizeSecrets("value is {{credentials.password}}")).toBe(
      "value is [REDACTED]"
    );
  });

  it("redacts bearer tokens", () => {
    expect(sanitizeSecrets("Bearer eyJhbGciOiJIUzI1NiJ9")).toBe("[REDACTED]");
  });

  it("preserves non-secret text", () => {
    const normal = "Step 3 failed: element not found (#login-btn)";
    expect(sanitizeSecrets(normal)).toBe(normal);
  });
});

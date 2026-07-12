import { describe, it, expect, vi, beforeEach } from "vitest";
import { rankSelectors, resolveElement } from "@/lib/self-healing";
import { detectCaptcha } from "@/lib/executor";
import { prisma } from "@/lib/prisma";

// Mock prisma and storage
vi.mock("@/lib/prisma", () => ({
  prisma: {
    selfHealingEvent: {
      create: vi.fn().mockResolvedValue({ id: "mock-event-id" }),
    },
    workflowRun: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    hitlAlert: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: "mock-hitl-id" }),
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue({
        id: "mock-workspace",
        browserMinutesUsed: 10,
        browserMinutesLimit: 100,
        storageBytesUsed: 1000,
        storageBytesLimit: 10000,
      }),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn().mockResolvedValue("mock-s3-key"),
  getSignedUrlForFile: vi.fn().mockResolvedValue("https://mock-signed-url.com"),
}));

describe("Phase 2 & 3 Features Suite", () => {
  
  describe("Deterministic Selector Ranking (self-healing.ts)", () => {
    it("correctly ranks data-testid as highest priority", () => {
      const selectors = {
        primary: ".btn-submit",
        testId: "submit-button",
        ariaLabel: "Submit Form",
        text: "Submit",
        css: "button[type='submit']",
      };

      const ranked = rankSelectors(selectors);
      expect(ranked[0].strategy).toBe("testId");
      expect(ranked[0].selector).toBe("[data-testid=\"submit-button\"]");
    });

    it("ranks ariaLabel above text and css", () => {
      const selectors = {
        primary: ".btn-submit",
        ariaLabel: "Submit Form",
        text: "Submit",
        css: "button[type='submit']",
      };

      const ranked = rankSelectors(selectors);
      expect(ranked[0].strategy).toBe("ariaLabel");
      expect(ranked[0].selector).toBe("[aria-label=\"Submit Form\"]");
    });

    it("ranks text above css", () => {
      const selectors = {
        primary: ".btn-submit",
        text: "Submit",
        css: "button[type='submit']",
      };

      const ranked = rankSelectors(selectors);
      expect(ranked[0].strategy).toBe("text");
      expect(ranked[0].selector).toBe("text=Submit");
    });
  });

  describe("CAPTCHA/2FA Proactive Detection (executor.ts)", () => {
    it("detects standard CAPTCHA in frame URL", async () => {
      // Mock page object
      const mockPage = {
        content: () => Promise.resolve(""),
        frames: () => [
          {
            url: () => "https://hcaptcha.com/challenge",
          },
        ],
      } as any;

      const hasCaptcha = await detectCaptcha(mockPage);
      expect(hasCaptcha).toBe(true);
    });

    it("detects cloudflare challenge in page content", async () => {
      const mockPage = {
        content: () => Promise.resolve("cf-challenge-running login protection page"),
        frames: () => [],
      } as any;

      const hasCaptcha = await detectCaptcha(mockPage);
      expect(hasCaptcha).toBe(true);
    });

    it("returns false if no CAPTCHA markers are present", async () => {
      const mockPage = {
        content: () => Promise.resolve("Welcome to standard user login page"),
        frames: () => [],
      } as any;

      const hasCaptcha = await detectCaptcha(mockPage);
      expect(hasCaptcha).toBe(false);
    });
  });

});

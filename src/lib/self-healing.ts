/**
 * BrowserOps — Self-Healing Selector Engine
 * ═══════════════════════════════════════════
 * Multi-vector element resolution following TRD Section 4.2.
 * Attempts to locate elements through fallback strategies when
 * the primary selector fails.
 */

import type { Page, ElementHandle } from "playwright";

export interface MultiVectorSelector {
  /** Primary selector (id, data-testid, CSS) */
  primary: string;
  /** Text content of the element */
  text?: string;
  /** CSS selector (may include dynamic classes) */
  css?: string;
  /** aria-label attribute */
  ariaLabel?: string;
  /** data-testid attribute */
  testId?: string;
  /** Relative visual position from workflow creation */
  position?: { x: number; y: number; width: number; height: number };
}

export interface SelfHealResult {
  /** Whether the element was found */
  found: boolean;
  /** The element handle if found */
  element: ElementHandle | null;
  /** The selector strategy that succeeded */
  strategy: string;
  /** Whether self-healing was needed */
  selfHealed: boolean;
  /** The original selector that failed (if self-healed) */
  originalSelector?: string;
  /** The new selector that worked (if self-healed) */
  newSelector?: string;
}

/**
 * Attempts to find an element using a multi-vector selector approach.
 * Falls back through multiple strategies if the primary selector fails.
 *
 * Strategy order (per TRD Section 4.2):
 * 1. Primary selector (id or data-testid)
 * 2. Text content within proximity
 * 3. CSS selector with increasing generalization
 * 4. aria-label
 * 5. Visual position proximity (if available)
 */
export async function resolveElement(
  page: Page,
  selectors: MultiVectorSelector,
  timeout: number = 5000
): Promise<SelfHealResult> {
  // Strategy 1: Primary selector
  try {
    const element = await page.waitForSelector(selectors.primary, {
      timeout: Math.min(timeout, 3000),
    });
    if (element) {
      return {
        found: true,
        element,
        strategy: "primary",
        selfHealed: false,
      };
    }
  } catch {
    // Primary failed, continue to fallbacks
  }

  // Strategy 2: data-testid
  if (selectors.testId) {
    try {
      const element = await page.waitForSelector(
        `[data-testid="${selectors.testId}"]`,
        { timeout: 2000 }
      );
      if (element) {
        return {
          found: true,
          element,
          strategy: "testId",
          selfHealed: true,
          originalSelector: selectors.primary,
          newSelector: `[data-testid="${selectors.testId}"]`,
        };
      }
    } catch {
      // Continue
    }
  }

  // Strategy 3: Text content
  if (selectors.text) {
    try {
      const element = await page.waitForSelector(
        `text="${selectors.text}"`,
        { timeout: 2000 }
      );
      if (element) {
        return {
          found: true,
          element,
          strategy: "text",
          selfHealed: true,
          originalSelector: selectors.primary,
          newSelector: `text="${selectors.text}"`,
        };
      }
    } catch {
      // Continue
    }

    // Try partial text match
    try {
      const element = await page.waitForSelector(
        `text=${selectors.text}`,
        { timeout: 1500 }
      );
      if (element) {
        return {
          found: true,
          element,
          strategy: "text-partial",
          selfHealed: true,
          originalSelector: selectors.primary,
          newSelector: `text=${selectors.text}`,
        };
      }
    } catch {
      // Continue
    }
  }

  // Strategy 4: CSS selector with generalization
  if (selectors.css) {
    try {
      const element = await page.waitForSelector(selectors.css, {
        timeout: 2000,
      });
      if (element) {
        return {
          found: true,
          element,
          strategy: "css",
          selfHealed: true,
          originalSelector: selectors.primary,
          newSelector: selectors.css,
        };
      }
    } catch {
      // Try removing dynamic classes (classes with numbers/hashes)
      const generalizedCss = generalizeSelector(selectors.css);
      if (generalizedCss !== selectors.css) {
        try {
          const element = await page.waitForSelector(generalizedCss, {
            timeout: 1500,
          });
          if (element) {
            return {
              found: true,
              element,
              strategy: "css-generalized",
              selfHealed: true,
              originalSelector: selectors.primary,
              newSelector: generalizedCss,
            };
          }
        } catch {
          // Continue
        }
      }
    }
  }

  // Strategy 5: aria-label
  if (selectors.ariaLabel) {
    try {
      const element = await page.waitForSelector(
        `[aria-label="${selectors.ariaLabel}"]`,
        { timeout: 2000 }
      );
      if (element) {
        return {
          found: true,
          element,
          strategy: "ariaLabel",
          selfHealed: true,
          originalSelector: selectors.primary,
          newSelector: `[aria-label="${selectors.ariaLabel}"]`,
        };
      }
    } catch {
      // Continue
    }
  }

  // Strategy 6: Visual position proximity
  if (selectors.position) {
    try {
      const element = await findByVisualProximity(page, selectors.position);
      if (element) {
        return {
          found: true,
          element,
          strategy: "visual-position",
          selfHealed: true,
          originalSelector: selectors.primary,
          newSelector: `visual-position(${selectors.position.x}, ${selectors.position.y})`,
        };
      }
    } catch {
      // Continue
    }
  }

  // All strategies exhausted
  return {
    found: false,
    element: null,
    strategy: "none",
    selfHealed: false,
    originalSelector: selectors.primary,
  };
}

/**
 * Removes dynamic class names (containing hashes, numbers, etc.)
 * from a CSS selector to make it more general.
 */
function generalizeSelector(css: string): string {
  return css
    // Remove classes that look like hash-based (e.g., .css-1a2b3c)
    .replace(/\.[a-zA-Z]+-[a-zA-Z0-9]{5,}/g, "")
    // Remove classes with random number suffixes (e.g., .button-42)
    .replace(/\.\w+-\d+/g, "")
    // Clean up double dots or trailing dots
    .replace(/\.{2,}/g, ".")
    .replace(/\.$/, "")
    .trim();
}

/**
 * Attempts to find an element near a known visual position.
 * Uses the page's elementFromPoint API to find clickable elements
 * in the vicinity of the stored coordinates.
 */
async function findByVisualProximity(
  page: Page,
  position: { x: number; y: number; width: number; height: number }
): Promise<ElementHandle | null> {
  const { x, y, width, height } = position;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Try center point first, then spiral outward
  const offsets = [
    [0, 0],
    [-10, 0], [10, 0], [0, -10], [0, 10],
    [-20, 0], [20, 0], [0, -20], [0, 20],
    [-10, -10], [10, -10], [-10, 10], [10, 10],
  ];

  for (const [dx, dy] of offsets) {
    const element = await page.evaluateHandle(
      ({ px, py }: { px: number; py: number }) => {
        const el = document.elementFromPoint(px, py);
        if (
          el &&
          el !== document.body &&
          el !== document.documentElement
        ) {
          return el;
        }
        return null;
      },
      { px: centerX + dx, py: centerY + dy }
    );

    const elementHandle = element.asElement();
    if (elementHandle) {
      return elementHandle;
    }
  }

  return null;
}

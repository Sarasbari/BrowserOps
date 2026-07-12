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
  /** Confidence score of the resolved selector (0.0 to 1.0) */
  confidenceScore: number;
  /** DOM snippet of the resolved element */
  evidenceSnippet?: string | null;
  /** True if multiple candidate elements matched this selector */
  multipleMatches?: boolean;
}

/**
 * Attempts to find a single element using a multi-vector selector approach.
 * Checks for uniqueness to prevent blind clicks on duplicate candidates.
 */
export function rankSelectors(selectors: MultiVectorSelector): { selector: string; strategy: string; score: number }[] {
  const candidates: { selector: string; strategy: string; score: number }[] = [];

  if (selectors.testId) {
    candidates.push({
      selector: `[data-testid="${selectors.testId}"]`,
      strategy: "testId",
      score: 0.95,
    });
  }

  if (selectors.ariaLabel) {
    candidates.push({
      selector: `[aria-label="${selectors.ariaLabel}"]`,
      strategy: "ariaLabel",
      score: 0.90,
    });
  }

  if (selectors.text) {
    candidates.push({
      selector: `text=${selectors.text}`,
      strategy: "text",
      score: 0.85,
    });
  }

  if (selectors.css) {
    candidates.push({
      selector: selectors.css,
      strategy: "css",
      score: 0.75,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export async function resolveElement(
  page: Page,
  selectors: MultiVectorSelector,
  timeout: number = 5000
): Promise<SelfHealResult> {
  const original = selectors.primary;

  // 1. Try Primary Selector
  const primaryRes = await evaluateSelectorCandidate(page, original, "primary", original, 1.0);
  if (primaryRes && primaryRes.found && !primaryRes.multipleMatches) {
    return primaryRes;
  }

  // Gather fallback candidates with confidence scores
  const candidates = rankSelectors(selectors);

  // Add partial/generalized fallback
  if (selectors.text) {
    candidates.push({
      selector: `text=${selectors.text}`,
      strategy: "text-partial",
      score: 0.70,
    });
  }
  if (selectors.css) {
    const generalized = generalizeSelector(selectors.css);
    if (generalized !== selectors.css) {
      candidates.push({
        selector: generalized,
        strategy: "css-generalized",
        score: 0.60,
      });
    }
  }

  // 2. Evaluate all candidates in priority order, looking for a UNIQUE match first
  let bestMultipleMatch: SelfHealResult | null = primaryRes && primaryRes.multipleMatches ? primaryRes : null;

  for (const cand of candidates) {
    const res = await evaluateSelectorCandidate(page, cand.selector, cand.strategy, original, cand.score);
    if (res && res.found) {
      if (!res.multipleMatches) {
        return res; // Found a unique fallback match!
      } else if (!bestMultipleMatch || res.confidenceScore > bestMultipleMatch.confidenceScore) {
        bestMultipleMatch = res; // Remember the best non-unique match
      }
    }
  }

  // 3. Try visual proximity as a last-resort fallback
  if (selectors.position) {
    try {
      const visualEl = await findByVisualProximity(page, selectors.position);
      if (visualEl) {
        const html = await visualEl.evaluate(el => el.outerHTML.slice(0, 500)).catch(() => null);
        return {
          found: true,
          element: visualEl,
          strategy: "visual-proximity",
          selfHealed: true,
          originalSelector: original,
          newSelector: `point(${selectors.position.x}, ${selectors.position.y})`,
          confidenceScore: 0.50,
          evidenceSnippet: html,
          multipleMatches: false,
        };
      }
    } catch {}
  }

  // 4. If we only have multiple matches, return it but flag it
  if (bestMultipleMatch) {
    return bestMultipleMatch;
  }

  // All strategies exhausted
  return {
    found: false,
    element: null,
    strategy: "none",
    selfHealed: false,
    originalSelector: original,
    confidenceScore: 0.0,
  };
}

/**
 * Evaluates a single selector candidate and returns element details.
 */
async function evaluateSelectorCandidate(
  page: Page,
  selector: string,
  strategy: string,
  originalSelector: string,
  baseScore: number
): Promise<SelfHealResult | null> {
  try {
    // Check if element exists (short timeout to keep fallback traversal fast)
    const elements = await page.$$(selector);
    if (elements.length === 1) {
      const html = await elements[0].evaluate(el => el.outerHTML.slice(0, 500)).catch(() => null);
      return {
        found: true,
        element: elements[0],
        strategy,
        selfHealed: strategy !== "primary",
        originalSelector,
        newSelector: selector,
        confidenceScore: baseScore,
        evidenceSnippet: html,
        multipleMatches: false,
      };
    } else if (elements.length > 1) {
      const html = await elements[0].evaluate(el => el.outerHTML.slice(0, 500)).catch(() => null);
      return {
        found: true,
        element: elements[0], // Return first candidate but flag it
        strategy,
        selfHealed: strategy !== "primary",
        originalSelector,
        newSelector: selector,
        confidenceScore: baseScore * 0.4, // Penalize heavily for duplicates
        evidenceSnippet: html,
        multipleMatches: true,
      };
    }
  } catch {}
  return null;
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
 * Uses the page's elementFromPoint API to find clickable elements.
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

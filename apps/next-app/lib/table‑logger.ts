// ────────────────────────────────────────────────────────────────
//  fixed‑width logger – no external deps, works in Node & Deno
// ────────────────────────────────────────────────────────────────

/**
 * A logger that prints lines like:
 *
 *   ✓ [tag]   <value>
 *
 * The length of the tag column is **fixed** – it is computed once
 * from the longest tag you pass to the logger on its *first* call.
 *
 * After the width is locked it will never change, even if a later
 * tag is longer.
 */
function createLogger() {
  // ----------- internal state -------------------------------------------------
  // The width that will be used for the *first* tag we ever see.
  // It is initialised to 0 and filled the first time `log()` is called.
  let fixedWidth = 16

  // A flag that tells us whether we have already locked the width.
  let widthLocked = true

  /**
   * The function that actually prints a line.
   *
   * @param tag  The label you want to display (e.g. "[relay]")
   * @param value  The message / URL that follows the tag
   */
  function log(tag: string, value: string): void {
    if (!widthLocked) {
      fixedWidth = tag.length
      widthLocked = true
    } else {
      if (tag.length > fixedWidth) {
        tag = tag.slice(0, fixedWidth)
      }
    }

    // -------------------------------------------------------------------------
    // 3️⃣  Pad the tag to the *right* so that all tags line up.
    // -------------------------------------------------------------------------
    // `padEnd` adds spaces on the right – exactly what we need for a left‑aligned column.
    const paddedTag = tag.padEnd(fixedWidth)

    // -------------------------------------------------------------------------
    // 4️⃣  Print the final line (the arrow + a space + the value)
    // -------------------------------------------------------------------------
    console.log(`✓ ${paddedTag} ${value}`)
  }

  // -------------------------------------------------------------------------
  // Expose the logger – callers only see `log(tag, value)`.
  // -------------------------------------------------------------------------
  return log
}

// Export for TypeScript / ESM / CommonJS users
export { createLogger }

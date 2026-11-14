/**
 * Context.dev web research integration
 * Handles /web/answers API calls with fast/ultra mode switching and fallback
 */

const API_BASE = 'https://api.context.dev/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 1;

/**
 * Research the web and return structured answers with sources
 * @param {string} task - Research task description
 * @param {object} jsonFormat - Example output object defining the JSON shape
 * @param {object} options - Configuration options
 * @param {string} options.mode - 'fast' (default) or 'ultra' for deeper research
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @param {number} options.maxRetries - Max retry attempts (default: 1)
 * @returns {Promise<{json_content: object, sources: array}>}
 */
export async function researchWeb(task, jsonFormat, options = {}) {
  const {
    mode = 'fast',
    timeout = DEFAULT_TIMEOUT,
    maxRetries = MAX_RETRIES,
  } = options;

  const apiKey = process.env.CONTEXT_DEV_API_KEY;
  if (!apiKey) {
    throw new Error('CONTEXT_DEV_API_KEY environment variable is not set');
  }

  const payload = {
    task,
    json_format: jsonFormat,
    mode,
  };

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${API_BASE}/web/answers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Context.dev API error (${response.status}): ${errorData}`
        );
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      // Don't retry on auth errors or validation errors
      if (
        error.message.includes('401') ||
        error.message.includes('400') ||
        error.message.includes('402')
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, etc.
        const delayMs = (attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Research with fast/ultra fallback logic
 * Tries 'fast' mode first, falls back to 'ultra' on error
 * @param {string} task - Research task description
 * @param {object} jsonFormat - Example output object
 * @param {object} options - Configuration options
 * @param {string} options.mode - 'fast' (default), 'ultra', or 'auto' for fallback
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @returns {Promise<{json_content: object, sources: array}>}
 */
export async function researchWebWithFallback(task, jsonFormat, options = {}) {
  const { mode = 'auto', timeout = DEFAULT_TIMEOUT } = options;

  if (mode === 'auto') {
    try {
      return await researchWeb(task, jsonFormat, {
        mode: 'fast',
        timeout,
        maxRetries: MAX_RETRIES,
      });
    } catch (error) {
      console.warn(
        'Fast mode failed, retrying with ultra mode:',
        error.message
      );
      return await researchWeb(task, jsonFormat, {
        mode: 'ultra',
        timeout,
        maxRetries: MAX_RETRIES,
      });
    }
  }

  return researchWeb(task, jsonFormat, { mode, timeout, maxRetries: MAX_RETRIES });
}

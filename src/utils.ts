// Pre-compiled regex for better performance
const CHINESE_REGEX = /[\u4e00-\u9fff]/g;
const NUMERIC_REGEX = /[0-9]/g;
const JSONP_MATCH_REGEX = /\((.+)\)$/;
const JSONP_ALT_MATCH_REGEX = /.*?\((.+)\)$/;

// Parse JSONP response by extracting JSON from the callback
export function parseSuggestionsResponse(jsonpText: string): string[] {
  // The response format from example.md: /*API*/_callbacks____9mctzuonq(["SUCCESS",...])
  // Extract JSON from JSONP callback format
  let match = jsonpText.match(JSONP_MATCH_REGEX);
  if (!match) {
    // Try alternative format without /*API*/ prefix
    match = jsonpText.match(JSONP_ALT_MATCH_REGEX);
    if (!match) {
      throw new Error("Invalid JSONP response format");
    }
  }

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(match[1]);
  } catch (parseError) {
    throw new Error("Failed to parse JSON response");
  }

  if (!Array.isArray(jsonData) || jsonData.length < 2) {
    throw new Error("Unexpected response format");
  }

  const [status, data] = jsonData;

  if (status !== "SUCCESS") {
    throw new Error(`API returned status: ${status}`);
  }

  // Extract suggestions from the response data
  // Format: [["m", ["唔","五","午",...], [], {...}]]
  const suggestions: string[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (Array.isArray(item) && item.length >= 2 && Array.isArray(item[1])) {
        suggestions.push(...item[1]);
      }
    }
  }

  return suggestions;
}

// Optimized: Extract Chinese characters and English from text in single pass
export const separateChineseAndEnglish = (text: string) => {
  if (!text) return { chinese: "", english: "" };
  
  let chinese = "";
  let english = "";
  
  // Single pass through the string instead of multiple regex operations
  for (const char of text) {
    if (CHINESE_REGEX.test(char)) {
      chinese += char;
      // Reset regex lastIndex since we're reusing it
      CHINESE_REGEX.lastIndex = 0;
    } else if (!NUMERIC_REGEX.test(char)) {
      english += char;
      // Reset regex lastIndex since we're reusing it
      NUMERIC_REGEX.lastIndex = 0;
    }
  }
  
  return { chinese, english };
};

// Cache for URL generation to avoid repeated encoding
const urlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100; // Prevent memory leaks

export function buildSuggestionsUrl(english: string, chinese?: string): string {
  const input = chinese ? `|${chinese},${english}` : english;
  
  // Check cache first
  const cacheKey = input;
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey)!;
  }
  
  const encodedInput = encodeURIComponent(input);
  
  // Use a fixed callback name to make the URL deterministic for useFetch.
  const callbackName = `_callbacks____raycast`;
  
  const url = `https://inputtools.google.com/request?text=${encodedInput}&itc=yue-hant-t-i0-und&num=13&cp=0&cs=1&ie=utf-8&oe=utf-8&app=jsapi&cb=${callbackName}`;
  
  // Cache the result, but prevent memory leaks
  if (urlCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = urlCache.keys().next().value;
    if (firstKey) {
      urlCache.delete(firstKey);
    }
  }
  urlCache.set(cacheKey, url);
  
  return url;
}

// Helper function to clear cache if needed (for testing or memory management)
export function clearUrlCache(): void {
  urlCache.clear();
} 
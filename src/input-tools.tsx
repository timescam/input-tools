import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { List, Action, ActionPanel, showToast, Toast, Icon, Color, Clipboard, getPreferenceValues } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { buildSuggestionsUrl, parseSuggestionsResponse, separateChineseAndEnglish } from "./utils";
import { Converter } from "opencc-js";

interface Suggestion {
  id: string;
  text: string;
  index: number;
}

interface Preferences {
  copyMode: "copy" | "copyPaste";
  simplifiedChinese: boolean;
}

// Constants
const SUGGESTIONS_PER_PAGE = 6;
const DEBOUNCE_DELAY = 200;
const INITIAL_DEBOUNCE_DELAY = 100;
const SELECTION_REGEX = /^(.*?)([1-6]|9|0)$/;

// Pre-compiled number parsing for better performance
const NUMERIC_KEYS = new Set(["1", "2", "3", "4", "5", "6", "9", "0"]);

// Pre-computed icon mapping for better performance
const NUMBER_ICONS = {
  1: Icon.Number01,
  2: Icon.Number02,
  3: Icon.Number03,
  4: Icon.Number04,
  5: Icon.Number05,
  6: Icon.Number06,
} as const;

// Custom hook for debouncing with cleanup optimization
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => setDebouncedValue(value), delay);

    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
};

// Optimized OpenCC converter hook with better memoization
const useOpenCCConverter = (enabled: boolean) => {
  return useMemo(() => {
    if (!enabled) return null;

    try {
      return Converter({ from: "hk", to: "cn" });
    } catch (error) {
      console.error("Failed to initialize OpenCC converter:", error);
      return null;
    }
  }, [enabled]);
};

// Split pagination calculations for better memoization
const usePaginationCalculations = (totalItems: number, itemsPerPage: number) => {
  return useMemo(() => {
    const safeItemsPerPage = Math.max(1, itemsPerPage);
    const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
    return { safeItemsPerPage, totalPages };
  }, [totalItems, itemsPerPage]);
};

const usePaginationState = (currentPage: number, totalPages: number, safeItemsPerPage: number) => {
  return useMemo(() => {
    const safePage = Math.min(currentPage, totalPages - 1);
    const hasNextPage = safePage < totalPages - 1;
    const hasPreviousPage = safePage > 0;
    const startIndex = safePage * safeItemsPerPage;
    const endIndex = (safePage + 1) * safeItemsPerPage;

    return {
      hasNextPage,
      hasPreviousPage,
      startIndex,
      endIndex,
      currentPage: safePage,
    };
  }, [currentPage, totalPages, safeItemsPerPage]);
};

// Memoized text conversion for expensive operations
const useTextConversion = (preferences: Preferences, converter: ((text: string) => string) | null) => {
  return useCallback(
    (text: string): string => {
      if (!preferences.simplifiedChinese || !converter || !text) {
        return text;
      }

      try {
        return converter(text);
      } catch (error) {
        console.error("Text conversion failed:", error);
        return text;
      }
    },
    [preferences.simplifiedChinese, converter],
  );
};

export default function InputTools() {
  const preferences = getPreferenceValues<Preferences>();
  const [searchText, setSearchText] = useState("");
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false);
  const debouncedSearchText = useDebounce(
    searchText,
    hasSelectedSuggestion ? DEBOUNCE_DELAY : INITIAL_DEBOUNCE_DELAY,
  );
  const [currentPage, setCurrentPage] = useState(0);

  // Custom hook for OpenCC conversion
  const converter = useOpenCCConverter(preferences.simplifiedChinese);
  const convertIfNeeded = useTextConversion(preferences, converter);

  // Reset page when search text changes
  useEffect(() => {
    setCurrentPage(0);
  }, [debouncedSearchText]);

  // Memoized URL with better caching strategy
  const suggestionsUrl = useMemo(() => {
    if (!debouncedSearchText.trim()) return "";

    const { chinese, english } = separateChineseAndEnglish(debouncedSearchText);
    if (!english.trim()) return "";

    return buildSuggestionsUrl(english, chinese);
  }, [debouncedSearchText]);

  // Fetch suggestions with enhanced error handling
  const {
    isLoading,
    data: suggestions,
    error,
    mutate,
  } = useFetch(suggestionsUrl, {
    execute: !!suggestionsUrl,
    keepPreviousData: true,
    initialData: [],
    async parseResponse(response) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const jsonpText = await response.text();
      return parseSuggestionsResponse(jsonpText);
    },
    onError(error) {
      showToast({
        style: Toast.Style.Failure,
        title: "API Error",
        message: error.message,
      });
    },
  });

  // Split pagination calculations for better performance
  const { safeItemsPerPage, totalPages } = usePaginationCalculations(suggestions?.length || 0, SUGGESTIONS_PER_PAGE);
  const pagination = usePaginationState(currentPage, totalPages, safeItemsPerPage);

  // Optimized paginated suggestions with simpler ID generation
  const paginatedSuggestions = useMemo(() => {
    if (!suggestions?.length) return [];

    return suggestions.slice(pagination.startIndex, pagination.endIndex).map((text: string, index: number) => ({
      id: String(pagination.currentPage * 1000 + index), // Simpler numeric ID as string
      text,
      index: index + 1,
    }));
  }, [suggestions, pagination.startIndex, pagination.endIndex, pagination.currentPage]);

  // Navigation functions with state validation
  const goToNextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1));
    }
  }, [pagination.hasNextPage, totalPages]);

  const goToPreviousPage = useCallback(() => {
    if (pagination.hasPreviousPage) {
      setCurrentPage((prev) => Math.max(prev - 1, 0));
    }
  }, [pagination.hasPreviousPage]);

  // Optimized suggestion selection with better state management
  const handleSuggestionSelect = useCallback(
    async (suggestion: Suggestion) => {
      const { chinese } = separateChineseAndEnglish(searchText);
      const newText = chinese + suggestion.text;

      // Update search text immediately for better UX
      setSearchText(newText);
      setHasSelectedSuggestion(true);

      // Clear suggestions optimistically
      mutate(Promise.resolve([]), {
        optimisticUpdate: () => [],
        shouldRevalidateAfter: false,
      });
    },
    [searchText, mutate],
  );

  // Optimized numeric action handling with early returns
  const handleNumericAction = useCallback(
    async (text: string): Promise<boolean> => {
      // Quick check for numeric ending
      const lastChar = text.slice(-1);
      if (!NUMERIC_KEYS.has(lastChar)) return false;

      const numberMatch = text.match(SELECTION_REGEX);
      if (!numberMatch) return false;

      const baseText = numberMatch[1];
      const num = parseInt(numberMatch[2], 10);

      // Handle suggestion selection (1-6)
      if (num >= 1 && num <= 6) {
        const selectedIndex = num - 1;
        if (selectedIndex < paginatedSuggestions.length) {
          const selectedSuggestion = paginatedSuggestions[selectedIndex];
          await handleSuggestionSelect(selectedSuggestion);
          return true;
        }
        return false;
      }

      // Handle pagination with improved feedback
      if (num === 0 && pagination.hasNextPage) {
        goToNextPage();
        setSearchText(baseText);
        return true;
      }

      if (num === 9 && pagination.hasPreviousPage) {
        goToPreviousPage();
        setSearchText(baseText);
        return true;
      }

      return false;
    },
    [
      paginatedSuggestions,
      pagination.hasNextPage,
      pagination.hasPreviousPage,
      goToNextPage,
      goToPreviousPage,
      handleSuggestionSelect,
    ],
  );

  // Optimized search text change handler
  const handleSearchTextChange = useCallback(
    async (text: string) => {
      // If text is empty, reset hasSelectedSuggestion
      if (!text.trim()) {
        setHasSelectedSuggestion(false);
      }

      // Handle numeric actions first (early return pattern)
      if (await handleNumericAction(text)) {
        return;
      }

      // Process normal text input
      const { chinese, english } = separateChineseAndEnglish(text);
      const newText = chinese + english;
      setSearchText(newText);
    },
    [handleNumericAction],
  );

  // Memoized converted text to avoid repeated conversions
  const convertedSearchText = useMemo(() => convertIfNeeded(searchText), [convertIfNeeded, searchText]);

  // Memoized action panels with better dependency tracking
  const inputPreviewActions = useMemo(
    () => (
      <ActionPanel>
        {preferences.copyMode === "copyPaste" && (
          <Action.Paste
            title="Paste"
            content={convertedSearchText}
            onPaste={() => {
              Clipboard.copy(convertedSearchText);
            }}
          />
        )}
        <Action.CopyToClipboard title="Copy" content={convertedSearchText} icon={Icon.Clipboard} />
      </ActionPanel>
    ),
    [preferences.copyMode, convertedSearchText],
  );

  // Stable action panels for navigation
  const navigationActions = useMemo(
    () => ({
      previous: (
        <ActionPanel>
          <Action title="Previous" onAction={goToPreviousPage} shortcut={{ modifiers: [], key: "arrowUp" }} />
        </ActionPanel>
      ),
      next: (
        <ActionPanel>
          <Action title="Next" onAction={goToNextPage} shortcut={{ modifiers: [], key: "arrowDown" }} />
        </ActionPanel>
      ),
    }),
    [goToPreviousPage, goToNextPage],
  );

  // Memoized suggestion action for better performance
  const createSuggestionAction = useCallback(
    (suggestion: Suggestion) => (
      <ActionPanel>
        <Action
          title="Select"
          onAction={() => handleSuggestionSelect(suggestion)}
          shortcut={{ modifiers: [], key: suggestion.index.toString() as "1" | "2" | "3" | "4" | "5" | "6" }}
        />
      </ActionPanel>
    ),
    [handleSuggestionSelect],
  );

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={handleSearchTextChange}
      searchBarPlaceholder="Type ..."
      throttle
    >
      {/* Input preview - only show when there's actual text */}
      {searchText && (
        <List.Item
          key="input-preview"
          title={searchText}
          icon={{ source: Icon.Keyboard, tintColor: Color.Magenta }}
          actions={inputPreviewActions}
        />
      )}

      {/* Error display */}
      {error && (
        <List.Item
          title="Error"
          subtitle={error.message}
          icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
        />
      )}

      {/* Previous page navigation */}
      {pagination.hasPreviousPage && (
        <List.Item
          title=""
          accessories={[{ text: "9" }]}
          icon={{ source: Icon.ArrowUp, tintColor: Color.Green }}
          actions={navigationActions.previous}
        />
      )}

      {/* Suggestions */}
      {!error &&
        paginatedSuggestions.map((suggestion) => (
          <List.Item
            key={suggestion.id}
            title={suggestion.text}
            accessories={[{ text: suggestion.index.toString() }]}
            icon={{ source: NUMBER_ICONS[suggestion.index as keyof typeof NUMBER_ICONS] }}
            actions={createSuggestionAction(suggestion)}
          />
        ))}

      {/* Next page navigation */}
      {pagination.hasNextPage && (
        <List.Item
          title={`${pagination.currentPage + 1}/${totalPages}`}
          accessories={[{ text: "0" }]}
          icon={{ source: Icon.ArrowDown, tintColor: Color.Green }}
          actions={navigationActions.next}
        />
      )}
    </List>
  );
}

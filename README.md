# Input Tools - Raycast Extension

A Raycast extension that provides real-time character suggestions for English input using the Google InputTools API.

## Features

-   **Real-time Suggestions**: Get instant character suggestions as you type in English.
-   **Pagination & Shortcuts**: Navigate suggestions with arrow keys and select quickly using number keys (1-6).
-   **Mixed Input**: Seamlessly combine Chinese characters with English text.
-   **Smart Parsing**: Only English parts of your input trigger new suggestions.
-   **Copy to Clipboard**: Press Enter to copy the entire mixed text to your clipboard.

## Development

1.  **Clone**: Clone this repository.
2.  **Install Dependencies**: Run `npm install` in the extension directory.
3.  **Import to Raycast**: Run `npm run dev` to start the development.

## Usage

1.  Open Raycast and search for "Input Tools".
2.  Type English characters to get Chinese suggestions.
3.  Press **1-6** to select a suggestion and add it to your input.
4.  Continue typing English for more suggestions.
5.  Press **Enter** to copy (and paste) the final text to your clipboard.

## Preferences

-   **Copy Mode**: Choose between "Copy" and "Copy & Paste".
-   **Simplified Chinese**: Enable to convert the final text to simplified Chinese.

## License

GPL-3.0-only License. 
/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Mode - Select the mode for the extension. */
  "copyMode"?: "copy" | "copyPaste",
  /** Simplified Chinese - Provide simplified Chinese suggestions. */
  "simplifiedChinese"?: boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `input-tools` command */
  export type InputTools = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `input-tools` command */
  export type InputTools = {}
}


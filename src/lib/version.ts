import packageJson from "../../package.json";

/** Única fuente de verdad: el `version` de `package.json`, no un valor hardcodeado aparte. */
export const APP_VERSION = packageJson.version;

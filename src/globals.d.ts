// Minimal process declaration for cross-runtime env var access.
// Avoids depending on @types/node so the SDK stays runtime-agnostic.
declare const process: undefined | {
  env: Record<string, string | undefined>;
  version: string;
};

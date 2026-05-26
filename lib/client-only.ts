/**
 * Client-only environment runtime assertions.
 * Enforces that browser APIs are not executed on the server.
 */
export function assertClient(moduleName?: string) {
  if (typeof window === 'undefined') {
    throw new Error(
      `SSR Safety Violation: Client-only module${
        moduleName ? ` "${moduleName}"` : ''
      } was executed on the server side.`
    );
  }
}

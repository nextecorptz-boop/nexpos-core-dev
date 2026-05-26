/**
 * Server-only environment runtime assertions.
 * Enforces that server/Node-only APIs are not executed in the browser.
 */
export function assertServer(moduleName?: string) {
  if (typeof window !== 'undefined') {
    throw new Error(
      `Security Violation: Server-only module${
        moduleName ? ` "${moduleName}"` : ''
      } was executed in the client browser.`
    );
  }
}

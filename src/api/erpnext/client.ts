import type { ApiEnvelope } from "@zatgo/erpnext";

export { callZatGoApi } from "@/lib/call-zatgo-api";

/** Unwraps an envelope to its data — callZatGoApi already throws on failure, so this is always success. */
export function unwrap<T>(env: ApiEnvelope<T>): T {
  return env.data;
}

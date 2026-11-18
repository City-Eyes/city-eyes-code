import { z } from "zod";

/**
 * Runtime validator for the shared API error envelope.
 * Orval emits the OpenAPI component as a TypeScript interface, not a Zod value.
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

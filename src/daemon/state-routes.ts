import {
  ACTIVATION_ROUTES,
  type ActivationServices
} from "./activation-routes.js";
import { ACTIVITY_ROUTES } from "./activity-routes.js";
import { DIAGNOSTICS_ROUTES } from "./diagnostics-routes.js";

/**
 * Route table for the local thread state: the activation contract, the closing activity snapshot and the
 * read-only diagnostics of a thread.
 */
export const STATE_ROUTES = [
  ...ACTIVATION_ROUTES,
  ...ACTIVITY_ROUTES,
  ...DIAGNOSTICS_ROUTES
];

export type { ActivationServices };

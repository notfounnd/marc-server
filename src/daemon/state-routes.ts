import {
  ACTIVATION_ROUTES,
  type ActivationServices
} from "./activation-routes.js";
import { ACTIVITY_ROUTES } from "./activity-routes.js";

/** Route table for the local thread state: the activation contract and the closing activity snapshot. */
export const STATE_ROUTES = [...ACTIVATION_ROUTES, ...ACTIVITY_ROUTES];

export type { ActivationServices };

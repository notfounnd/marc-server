import * as React from "react";
import type { Message, ThreadActivationView } from "./types.js";
import type { ThreadActivationState } from "./use-thread-activation.js";

/** The thread activation view of the selected thread, shared by the panel and the message stamps. */
export type ThreadActivationContextValue = {
  state: ThreadActivationState;
  replace: (view: ThreadActivationView) => void;
  reload: () => void;
  messages: Message[];
};

const EMPTY_VALUE: ThreadActivationContextValue = {
  state: { key: "", status: "loading" },
  replace: () => undefined,
  reload: () => undefined,
  messages: []
};

const ThreadActivationContext =
  React.createContext<ThreadActivationContextValue>(EMPTY_VALUE);

/** The app provides the value once for the selected thread. Outside a provider the panel stays loading. */
export const ThreadActivationProvider = ThreadActivationContext.Provider;

export function useThreadActivationContext(): ThreadActivationContextValue {
  return React.useContext(ThreadActivationContext);
}

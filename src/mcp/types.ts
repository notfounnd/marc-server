export type McpOptions = {
  workspace?: string;
  daemonUrl?: string;
  token?: string;
  /** Test seam: the transport of the activation calls. Defaults to the global fetch. */
  activationFetch?: typeof fetch;
  /** Test seam: the time limit of each stamp call. Defaults to 1.5 seconds. */
  activationTimeoutMs?: number;
};

import type { ServerConfig } from "@t3tools/contracts";
import { useMemo } from "react";

import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { isDesktopLocalConnectionTarget } from "~/connection/desktopLocal";
import {
  buildLocalEnvironmentUpdateGroups,
  deriveEnvironmentDisplayLabel,
  environmentUpdateConnectionState,
  type LocalEnvironmentProvidersInput,
  type LocalEnvironmentUpdateGroup,
} from "./ProviderUpdateLaunchNotification.logic";

/**
 * Reactively enumerate every environment the client knows about (the primary,
 * a desktop-local WSL backend, remote servers) with each one's full provider
 * list and a flag for whether any is still connecting. Drives the launch
 * popover's gating and its per-environment update triggers.
 */
export function useLocalEnvironmentUpdateGroups(): {
  readonly groups: LocalEnvironmentUpdateGroup[];
  readonly isAnySettling: boolean;
} {
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();

  return useMemo(() => {
    const inputs: LocalEnvironmentProvidersInput[] = [];

    for (const environment of environments) {
      const isPrimary = environment.environmentId === primaryEnvironmentId;
      const serverConfig: ServerConfig | null = environment.serverConfig;

      inputs.push({
        environmentId: environment.environmentId,
        // Secondaries carry a meaningful label straight from the platform source
        // (e.g. "WSL (Ubuntu)"). The primary's catalog label can be the account
        // name, so fall back to its platform OS so the row reads "Windows"/"Linux".
        label: isPrimary
          ? deriveEnvironmentDisplayLabel({
              isWsl: false,
              wslDistro: null,
              platformOs: serverConfig?.environment.platform.os,
              fallbackLabel: environment.label,
            })
          : environment.label,
        isPrimary,
        // The primary is the backend serving this renderer, so it is ready
        // whenever its providers are available; secondaries report their live
        // connection phase.
        connectionState: isPrimary
          ? "ready"
          : environmentUpdateConnectionState(
              environment.connection.phase,
              isDesktopLocalConnectionTarget(environment.entry.target),
            ),
        providers: serverConfig?.providers ?? [],
      });
    }

    // Primary first, then the rest in catalog order.
    inputs.sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));

    return buildLocalEnvironmentUpdateGroups(inputs);
  }, [environments, primaryEnvironmentId]);
}

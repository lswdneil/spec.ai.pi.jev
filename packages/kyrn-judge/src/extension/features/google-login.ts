import { antigravityProvider, geminiCliProvider } from "../../google-login/providers.ts";
import type { KyrnRuntime } from "../runtime.ts";

/**
 * Signing in with a Google account under /login: through Gemini CLI's login
 * (the Gemini models) or Antigravity's (Gemini, Claude, GPT-OSS). pi dropped
 * both upstream; spec.jev keeps them as experimental. Before the browser opens, the
 * sign-in says what the risk is (these are Google's logins for its own tools)
 * and goes on only when the person agrees.
 *
 * The official routes need nothing from spec.jev: a Gemini API key (provider
 * "google") and Vertex AI with gcloud's application default credentials
 * (provider "google-vertex"). Grok's sign-in (provider "xai") is pi's own.
 */
export function registerGoogleLogin(runtime: KyrnRuntime): void {
	const options = runtime.options("googleLogin", { enabled: true, geminiCli: true, antigravity: true });
	if (!options.enabled) return;
	if (options.geminiCli) runtime.pi.registerProvider(geminiCliProvider());
	if (options.antigravity) runtime.pi.registerProvider(antigravityProvider());
}

export interface ContentAnnotations {
	audience?: ("user" | "assistant")[];
	priority?: number;
	lastModified?: string;
}

export interface TextContent {
	type: "text";
	text: string;
	annotations?: ContentAnnotations;
	_meta?: Record<string, unknown>;
}

export interface ImageContent {
	type: "image";
	data: string;
	mimeType: string;
	annotations?: ContentAnnotations;
	_meta?: Record<string, unknown>;
}

export interface AudioContent {
	type: "audio";
	data: string;
	mimeType: string;
	annotations?: ContentAnnotations;
	_meta?: Record<string, unknown>;
}

export interface ResourceLinkContent {
	type: "resource_link";
	uri: string;
	name: string;
	title?: string;
	description?: string;
	mimeType?: string;
	size?: number;
	annotations?: ContentAnnotations;
	_meta?: Record<string, unknown>;
}

export interface TextResourceContents {
	uri: string;
	mimeType?: string;
	text: string;
	_meta?: Record<string, unknown>;
}

export interface BlobResourceContents {
	uri: string;
	mimeType?: string;
	blob: string;
	_meta?: Record<string, unknown>;
}

export interface EmbeddedResourceContent {
	type: "resource";
	resource: TextResourceContents | BlobResourceContents;
	annotations?: ContentAnnotations;
	_meta?: Record<string, unknown>;
}

export type ContentBlock = TextContent | ImageContent | AudioContent | ResourceLinkContent | EmbeddedResourceContent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";
const isOptionalRecord = (value: unknown): boolean => value === undefined || isRecord(value);

function isAnnotations(value: unknown): value is ContentAnnotations {
	if (value === undefined) return true;
	if (!isRecord(value)) return false;
	return (
		(value.audience === undefined ||
			(Array.isArray(value.audience) &&
				value.audience.every((audience) => audience === "user" || audience === "assistant"))) &&
		(value.priority === undefined || typeof value.priority === "number") &&
		(value.lastModified === undefined || typeof value.lastModified === "string")
	);
}

/** Structural validation for untrusted server content before it reaches an LLM adapter. */
export function isContentBlock(value: unknown): value is ContentBlock {
	if (!isRecord(value) || typeof value.type !== "string") return false;
	if (!isAnnotations(value.annotations) || !isOptionalRecord(value._meta)) return false;
	switch (value.type) {
		case "text":
			return typeof value.text === "string";
		case "image":
		case "audio":
			return typeof value.data === "string" && typeof value.mimeType === "string";
		case "resource_link":
			return (
				typeof value.uri === "string" &&
				typeof value.name === "string" &&
				isOptionalString(value.title) &&
				isOptionalString(value.description) &&
				isOptionalString(value.mimeType) &&
				(value.size === undefined || typeof value.size === "number")
			);
		case "resource": {
			if (!isRecord(value.resource)) return false;
			const resource = value.resource;
			const text = typeof resource.text === "string";
			const blob = typeof resource.blob === "string";
			return (
				typeof resource.uri === "string" &&
				text !== blob &&
				isOptionalString(resource.mimeType) &&
				isOptionalRecord(resource._meta)
			);
		}
		default:
			return false;
	}
}

export interface CallToolResult {
	content: ContentBlock[];
	/** Any JSON value, including arrays and `null` (MCP 2026-07-28; earlier revisions allowed only objects). */
	structuredContent?: unknown;
	isError?: boolean;
	_meta?: Record<string, unknown>;
}

/**
 * Tool result content in the shape LLM APIs accept: text and base64 images. Matches the
 * `TextContent` and `ImageContent` types of `@earendil-works/pi-ai`.
 */
export type LlmContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

function blockToLlmContent(block: ContentBlock): LlmContent {
	switch (block.type) {
		case "text":
			return { type: "text", text: block.text };
		case "image":
			return { type: "image", data: block.data, mimeType: block.mimeType };
		case "audio":
			return { type: "text", text: `[audio ${block.mimeType} omitted]` };
		case "resource_link":
			return { type: "text", text: `${block.name}: ${block.uri}` };
		case "resource": {
			const resource = block.resource;
			if ("text" in resource) return { type: "text", text: resource.text };
			if (resource.mimeType?.startsWith("image/")) {
				return { type: "image", data: resource.blob, mimeType: resource.mimeType };
			}
			return {
				type: "text",
				text: `[binary resource ${resource.uri} (${resource.mimeType ?? "unknown type"}) omitted]`,
			};
		}
		default:
			return { type: "text", text: `[unsupported MCP content ${(block as { type: string }).type}]` };
	}
}

/**
 * Convert a tool result to text and image content for a model. Text and images pass through,
 * embedded text resources become text, embedded image resources become images, and other blocks
 * (audio, resource links, binary resources) become a short text placeholder. A result without
 * content blocks but with `structuredContent` becomes its JSON, since servers should, but do not
 * always, mirror structured results as text.
 */
export function toLlmContent(result: Pick<CallToolResult, "content" | "structuredContent">): LlmContent[] {
	const content = (result.content ?? []).map(blockToLlmContent);
	if (content.length === 0 && result.structuredContent !== undefined) {
		content.push({ type: "text", text: JSON.stringify(result.structuredContent, null, 2) });
	}
	return content;
}

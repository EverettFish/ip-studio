export type WorkflowId =
  | "anchor"
  | "article"
  | "infographic"
  | "photo"
  | "stickers"
  | "folders"
  | "letter"
  | "polaroid"
  | "avatars"
  | "expressions"
  | "possession";

export type ConfigValue = string | number | boolean;
export type WorkflowConfig = Record<string, ConfigValue>;

export type AnchorStyleId = "original" | "mengli" | "island-3d" | "flat";

export type FieldOption = { label: string; value: string };

export type FieldDefinition = {
  key: string;
  label: string;
  help?: string;
  kind: "text" | "textarea" | "select" | "number" | "toggle";
  placeholder?: string;
  defaultValue: ConfigValue;
  options?: FieldOption[];
  min?: number;
  max?: number;
};

export type WorkflowDefinition = {
  id: WorkflowId;
  number: string;
  title: string;
  eyebrow: string;
  description: string;
  color: "coral" | "mint" | "butter" | "blue" | "lilac";
  routeImage: string;
  fields: FieldDefinition[];
  needsArticle?: boolean;
  needsSources?: boolean;
  sourceLabel?: string;
  sourceHelp?: string;
  accept?: string;
};

export type GenerationJob = {
  id: string;
  title: string;
  prompt: string;
  size: string;
  background: "auto" | "opaque" | "transparent";
  sourceIndex?: number;
};

export type JobState = GenerationJob & {
  status: "queued" | "generating" | "done" | "error";
  image?: string;
  imageBlob?: Blob;
  error?: string;
};

export type AnchorRecord = {
  id: "primary";
  name: string;
  blob: Blob;
  sourceName?: string;
  sourceBlob?: Blob;
  styleId?: AnchorStyleId;
  updatedAt: number;
};

export type ArtworkRecord = {
  id: string;
  workflow: WorkflowId;
  title: string;
  blob: Blob;
  createdAt: number;
};

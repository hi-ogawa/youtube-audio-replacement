import { Check, CircleHelp, Plus } from "lucide-react";
import { useState } from "react";
import {
  type ModelFilename,
  modelAssetUrl,
} from "../lib/demucs/audio/models.ts";
import type { Preferences } from "../lib/demucs/preferences.ts";
import type { RunProgress } from "../lib/demucs/progress/model.ts";
import { RunProgressPanel } from "../lib/demucs/progress/panel.tsx";

export type StemGeneratorSource = {
  name: string;
  detail: string;
};

export type StemGeneratorSourceState =
  | { status: "empty" }
  | {
      status: "loading";
      progress?: { bytesReceived: number; totalBytes: number };
    }
  | { status: "ready"; source: StemGeneratorSource };

export type StemGeneratorSourceMode = "youtube" | "local";

export type StemGeneratorSourceStates = Record<
  StemGeneratorSourceMode,
  StemGeneratorSourceState
>;

type ModelFileState = {
  name: ModelFilename;
  ready: boolean;
  error?: string;
};

type GeneratedFile = {
  name: string;
  url: string;
};

export function StemGeneratorView({
  initialInput,
  sourceMode,
  sourceStates,
  sourceError,
  onLoadYouTube,
  onChooseLocalFile,
  onSourceModeChange,
  onRemoveSource,
  onSaveSource,
  configuration,
  onConfigurationChange,
  modelFiles,
  unsupportedModelFiles,
  modelStorageError,
  onChooseModelFiles,
  separationPending,
  separationProgress,
  separationStatus,
  separationError,
  onSeparate,
  canSeparate,
  results,
}: {
  initialInput: string;
  sourceMode: StemGeneratorSourceMode;
  sourceStates: StemGeneratorSourceStates;
  sourceError?: string;
  onLoadYouTube(input: string): void;
  onChooseLocalFile(file: File): void;
  onSourceModeChange(mode: StemGeneratorSourceMode): void;
  onRemoveSource(mode: StemGeneratorSourceMode): void;
  onSaveSource(): void;
  configuration: Preferences;
  onConfigurationChange(configuration: Preferences): void;
  modelFiles: ModelFileState[];
  unsupportedModelFiles: string[];
  modelStorageError?: string;
  onChooseModelFiles(files: File[], expected?: ModelFilename): void;
  separationPending: boolean;
  separationProgress?: RunProgress | null;
  separationStatus?: string;
  separationError?: string;
  onSeparate(): void;
  canSeparate: boolean;
  results?: {
    outputs: GeneratedFile[];
    archive: GeneratedFile;
  };
}) {
  const [input, setInput] = useState(initialInput);
  const sourceState = sourceStates[sourceMode];
  const source =
    sourceState.status === "ready" ? sourceState.source : undefined;
  const youtubeSourceLoading = sourceStates.youtube.status === "loading";
  const youtubeSourceLoadingPercent =
    sourceStates.youtube.status === "loading" &&
    sourceStates.youtube.progress?.totalBytes
      ? Math.round(
          (sourceStates.youtube.progress.bytesReceived /
            sourceStates.youtube.progress.totalBytes) *
            100,
        )
      : undefined;

  return (
    <div className="grid gap-5">
      <Section
        number="1"
        title="Choose audio"
        description="Select the track you want to separate."
      >
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-button p-1"
          role="group"
          aria-label="Audio source"
        >
          <button
            className={`cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition-colors ${sourceMode === "youtube" ? "bg-panel text-foreground shadow-sm" : "text-muted-foreground hover:bg-button-hover hover:text-foreground"}`}
            type="button"
            aria-pressed={sourceMode === "youtube"}
            disabled={separationPending}
            onClick={() => {
              if (sourceMode !== "youtube") {
                onSourceModeChange("youtube");
              }
            }}
          >
            YouTube video
          </button>
          <button
            className={`cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition-colors ${sourceMode === "local" ? "bg-panel text-foreground shadow-sm" : "text-muted-foreground hover:bg-button-hover hover:text-foreground"}`}
            type="button"
            aria-pressed={sourceMode === "local"}
            disabled={separationPending}
            onClick={() => {
              if (sourceMode !== "local") {
                onSourceModeChange("local");
              }
            }}
          >
            Local file
          </button>
        </div>

        <div className="mt-3">
          {source ? (
            <SelectedSource
              mode={sourceMode}
              source={source}
              onSave={onSaveSource}
              onRemove={() => onRemoveSource(sourceMode)}
              disabled={separationPending}
            />
          ) : sourceMode === "youtube" ? (
            <>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  onLoadYouTube(input);
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">YouTube video ID or URL</span>
                  <input
                    className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm outline-none focus:border-accent-border"
                    value={input}
                    placeholder="YouTube video ID or URL"
                    disabled={youtubeSourceLoading}
                    onChange={(event) => setInput(event.target.value)}
                  />
                </label>
                <button
                  className="h-11 cursor-pointer rounded-md bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-60 sm:w-44"
                  type="submit"
                  disabled={youtubeSourceLoading}
                >
                  {youtubeSourceLoading
                    ? youtubeSourceLoadingPercent === undefined
                      ? "Loading..."
                      : `Loading ${youtubeSourceLoadingPercent}%`
                    : "Load from YouTube"}
                </button>
              </form>
              {sourceError && (
                <p className="mt-3 text-sm text-error" role="alert">
                  {sourceError}
                </p>
              )}
            </>
          ) : (
            <input
              className="w-full cursor-pointer rounded-md border border-dashed border-button-border bg-button p-2.5 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
              type="file"
              accept="audio/*"
              disabled={separationPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                onChooseLocalFile(file);
                event.target.value = "";
              }}
            />
          )}
        </div>
      </Section>

      <Section
        number="2"
        title="Choose output"
        description="Choose which tracks to create. “Other instruments” includes guitars, keys, and anything not classified as vocals, drums, or bass. You can adjust track balance later in the YouTube mixer."
      >
        <OutputConfiguration
          configuration={configuration}
          disabled={separationPending}
          onChange={onConfigurationChange}
        />
      </Section>

      <Section
        number="3"
        title="Add models"
        description="Download each required model, then drop or select the downloaded file."
      >
        <div className="grid gap-2.5">
          {modelFiles.map((modelFile) => (
            <ModelFileSlot
              key={modelFile.name}
              filename={modelFile.name}
              ready={modelFile.ready}
              error={modelFile.error}
              disabled={separationPending}
              onChoose={(files) => onChooseModelFiles(files, modelFile.name)}
            />
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Alternatively,{" "}
          <label className="cursor-pointer font-semibold text-accent underline underline-offset-3 hover:opacity-80">
            choose multiple files at once
            <input
              className="sr-only"
              type="file"
              id="modelFiles"
              accept=".bin,.onnx"
              multiple
              disabled={separationPending}
              onChange={(event) =>
                onChooseModelFiles([...(event.target.files ?? [])])
              }
            />
          </label>
          .
        </p>
        {unsupportedModelFiles.length > 0 && (
          <p className="mt-2 text-sm text-error">
            Unsupported files: {unsupportedModelFiles.join(", ")}.
          </p>
        )}
        {modelStorageError && (
          <p className="mt-2 text-sm text-error" role="alert">
            {modelStorageError}
          </p>
        )}
      </Section>

      <Section number="4" title="Separate">
        <button
          className="h-13 w-full cursor-pointer rounded-md bg-accent text-sm font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-40"
          type="button"
          disabled={!source || !canSeparate || separationPending}
          onClick={onSeparate}
        >
          {separationPending ? "Separating..." : "Separate track"}
        </button>
        {(!source || !canSeparate) && !separationPending && (
          <p className="mt-3 text-sm text-muted-foreground">
            Choose audio and add all required models before starting.
          </p>
        )}
        {separationProgress && (
          <RunProgressPanel progress={separationProgress} />
        )}
        {separationStatus && (
          <p
            className="mt-3.5 text-sm leading-normal whitespace-pre-line text-muted-foreground"
            id="status"
          >
            {separationStatus}
          </p>
        )}
        {separationError && (
          <p className="mt-3 text-sm text-error" role="alert">
            {separationError}
          </p>
        )}
      </Section>

      {results && (
        <section className="rounded-xl border border-border bg-panel p-5 shadow-lg sm:p-7">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-accent uppercase">
                Separation complete
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Your stems</h2>
            </div>
            <a
              className="cursor-pointer text-sm font-semibold text-accent hover:underline"
              href={results.archive.url}
              download={results.archive.name}
            >
              Download ZIP
            </a>
          </div>
          <div className="grid gap-3">
            {results.outputs.map((output) => (
              <StemRow
                key={output.name}
                name={output.name}
                url={output.url}
                source={configuration.twoStems}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const OUTPUT_OPTIONS: {
  value: Preferences["twoStems"];
  label: string;
  description: string;
}[] = [
  {
    value: null,
    label: "Four stems",
    description: "Create vocals, drums, bass, and “other” stems",
  },
  {
    value: "vocals",
    label: "Vocals + backing",
    description: "Create a vocals stem and a backing track without vocals",
  },
  {
    value: "drums",
    label: "Drums + backing",
    description: "Create a drums stem and a backing track without drums",
  },
  {
    value: "bass",
    label: "Bass + backing",
    description: "Create a bass stem and a backing track without bass",
  },
  {
    value: "other",
    label: "Other instruments + backing",
    description: "Create an “other” stem and a backing track without it",
  },
];

function OutputConfiguration({
  configuration,
  disabled,
  onChange,
}: {
  configuration: Preferences;
  disabled: boolean;
  onChange(configuration: Preferences): void;
}) {
  return (
    <>
      <fieldset>
        <legend className="sr-only">Stem output</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {OUTPUT_OPTIONS.map((option) => (
            <OutputOption
              key={option.label}
              option={option}
              selected={configuration.twoStems === option.value}
              disabled={disabled}
              onSelect={() =>
                onChange({ ...configuration, twoStems: option.value })
              }
            />
          ))}
        </div>
      </fieldset>

      <details className="group mt-3 rounded-lg border border-button-border bg-button">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-90">
            ›
          </span>
          <span className="shrink-0">Advanced settings</span>
          <span className="ml-auto min-w-0 truncate text-right text-xs font-normal text-muted-foreground">
            {configuration.model} · {configuration.shifts} shift
            {configuration.shifts === 1 ? "" : "s"} ·{" "}
            {configuration.method === "minus"
              ? "subtract source"
              : "combine other stems"}
          </span>
        </summary>
        <div className="grid gap-4 border-t border-button-border p-3 sm:grid-cols-2">
          <Field
            label="Model"
            htmlFor="model"
            help="Choose a standard general-purpose model or a fine-tuned model specialized for a source."
          >
            <select
              className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm"
              id="model"
              value={configuration.model}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...configuration,
                  model: event.target.value as Preferences["model"],
                })
              }
            >
              <option value="htdemucs">htdemucs</option>
              <option value="htdemucs_ft">htdemucs_ft</option>
            </select>
          </Field>
          <Field
            label="Shifts"
            htmlFor="shifts"
            help="Choose how many processing passes to average. More shifts can improve separation quality, but runtime increases roughly in proportion."
          >
            <input
              className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm"
              type="number"
              id="shifts"
              min="1"
              max="4"
              value={configuration.shifts}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...configuration,
                  shifts: Number(event.target.value),
                })
              }
            />
          </Field>
          <Field
            label="Backing mix"
            htmlFor="method"
            help="Subtract source removes the selected source from the original. With htdemucs_ft, it runs about four times faster than Combine other stems. Combine other stems mixes the other separated stems. Results vary by track."
          >
            <select
              className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm disabled:opacity-50"
              id="method"
              value={configuration.method}
              disabled={!configuration.twoStems || disabled}
              onChange={(event) =>
                onChange({
                  ...configuration,
                  method: event.target.value as Preferences["method"],
                })
              }
            >
              <option value="minus">Subtract source</option>
              <option value="add">Combine other stems</option>
            </select>
          </Field>
        </div>
      </details>
      <p
        className="mt-4 rounded-md bg-button px-3 py-2.5 text-sm leading-relaxed text-muted-foreground"
        id="outputSummary"
      >
        {configuration.twoStems ? (
          <>
            Creates{" "}
            <strong className="text-foreground">
              {configuration.twoStems}.wav
            </strong>{" "}
            and <strong className="text-foreground">backing.wav</strong>.
          </>
        ) : (
          <>
            Creates <strong className="text-foreground">vocals.wav</strong>,{" "}
            <strong className="text-foreground">drums.wav</strong>,{" "}
            <strong className="text-foreground">bass.wav</strong>, and{" "}
            <strong className="text-foreground">other.wav</strong>.
          </>
        )}
      </p>
    </>
  );
}

function OutputOption({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: (typeof OUTPUT_OPTIONS)[number];
  selected: boolean;
  disabled: boolean;
  onSelect(): void;
}) {
  return (
    <label
      className={`flex min-h-18 gap-3 rounded-lg border p-3 transition-colors ${
        option.value === null ? "sm:col-span-2" : ""
      } ${
        selected
          ? "border-accent-border bg-blue-50 ring-1 ring-accent-border dark:bg-blue-950/35"
          : "border-button-border bg-panel hover:bg-button"
      } ${disabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
    >
      <input
        className="mt-0.5 size-4 shrink-0 accent-accent"
        type="radio"
        name="output"
        value={option.value ?? ""}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <span>
        <strong className="block text-sm font-semibold">{option.label}</strong>
        <span className="mt-1 block text-sm leading-snug text-muted-foreground">
          {option.description}
        </span>
      </span>
    </label>
  );
}

function SelectedSource({
  mode,
  source,
  onSave,
  onRemove,
  disabled,
}: {
  mode: StemGeneratorSourceMode;
  source: StemGeneratorSource;
  onSave(): void;
  onRemove(): void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-button-border bg-button p-4">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-white"
        aria-hidden="true"
      >
        <svg
          className="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m3 8 3 3 7-7" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{source.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {mode === "youtube" ? "YouTube" : "Local file"} / {source.detail}
        </p>
      </div>
      <div className="ml-12 flex w-full items-center gap-3 sm:ml-0 sm:w-auto">
        {mode === "youtube" && (
          <button
            className="cursor-pointer text-sm font-medium text-accent hover:underline"
            type="button"
            onClick={onSave}
          >
            Save source audio
          </button>
        )}
        <button
          className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-button-hover hover:text-foreground"
          type="button"
          aria-label="Remove source"
          title="Remove source"
          disabled={disabled}
          onClick={onRemove}
        >
          <svg
            className="size-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6.5v5M8 6.5v5M11 6.5v5M4.5 4.5l.5 9h6l.5-9" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-panel p-5 shadow-lg sm:p-7">
      <h2 className="text-xl font-semibold">
        {number}. {title}
      </h2>
      {description && (
        <p className="mt-1.5 mb-5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {!description && <div className="h-4" />}
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <label htmlFor={htmlFor}>{label}</label>
        <FieldHelp>{help}</FieldHelp>
      </div>
      {children}
    </div>
  );
}

function ModelFileSlot({
  filename,
  ready,
  error,
  disabled,
  onChoose,
}: {
  filename: ModelFilename;
  ready: boolean;
  error?: string;
  disabled: boolean;
  onChoose(files: File[]): void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div data-testid="model-file-slot">
      <div
        className={`flex min-h-13 items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
          dragging
            ? "border-accent-border bg-button-hover"
            : ready
              ? "border-accent-border bg-button hover:bg-button-hover"
              : "border-button-border bg-button hover:border-accent-border hover:bg-button-hover border-dashed"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !disabled) {
            onChoose([file]);
          }
        }}
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            ready
              ? "bg-accent text-white"
              : "border border-button-border text-muted-foreground"
          }`}
          aria-hidden="true"
        >
          {ready ? <Check className="size-4" /> : <Plus className="size-4" />}
        </span>
        <code className="min-w-0 flex-1 truncate text-sm font-semibold">
          {filename}
        </code>
        <a
          className="shrink-0 text-sm font-semibold text-accent underline underline-offset-3 hover:opacity-80"
          href={modelAssetUrl(filename)}
        >
          Download
        </a>
        <label className="shrink-0 cursor-pointer text-sm font-bold text-accent">
          {ready ? "Ready" : "Choose file"}
          <input
            className="sr-only"
            type="file"
            aria-label={`Select ${filename}`}
            accept={filename.endsWith(".onnx") ? ".onnx" : ".bin"}
            disabled={disabled}
            onChange={(event) => {
              onChoose([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
    </div>
  );
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative normal-case">
      <summary
        className="flex size-5 cursor-pointer list-none items-center justify-center text-muted-foreground hover:text-accent [&::-webkit-details-marker]:hidden"
        aria-label="More information"
      >
        <CircleHelp aria-hidden="true" className="size-5" />
      </summary>
      <div className="absolute top-7 right-0 z-10 w-56 rounded-md border border-border bg-panel p-3 text-sm leading-relaxed font-normal tracking-normal text-foreground shadow-lg sm:w-64">
        {children}
      </div>
    </details>
  );
}

function StemRow({
  name,
  url,
  source,
}: {
  name: string;
  url: string;
  source: string | null;
}) {
  const label = stemLabel(name, source);
  return (
    <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3.5 rounded-md border border-border bg-button p-4">
      <b className="text-xl font-semibold capitalize">{label}</b>
      <audio className="col-span-full w-full" controls src={url} />
      <a
        className="cursor-pointer text-sm font-semibold text-accent hover:underline"
        href={url}
        download={`${name}.wav`}
      >
        Download WAV
      </a>
    </div>
  );
}

function stemLabel(name: string, source: string | null): string {
  if (name === "backing" && source) {
    return `Backing track (without ${source})`;
  }
  return name;
}

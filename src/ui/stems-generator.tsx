import { useState } from "react";
import type {
  ModelFilename,
  SeparationConfiguration,
} from "../lib/demucs/models.ts";
import type { RunProgress } from "../lib/demucs/progress.ts";

export type StemsGeneratorSource = {
  kind: "YouTube" | "Local file";
  name: string;
  detail: string;
};

export type StemsGeneratorSourceState =
  | { status: "empty" }
  | {
      status: "loading";
      progress?: { bytesReceived: number; totalBytes: number };
    }
  | { status: "ready"; source: StemsGeneratorSource };

export function StemsGeneratorView({
  initialInput,
  sourceState,
  sourceError,
  onLoadYouTube,
  onChooseLocalFile,
  onRemoveSource,
  onSaveSource,
  configuration,
  onConfigurationChange,
  modelFiles,
  modelStorageError,
  onChooseModelFiles,
  separationPending,
  separationProgress,
  separationError,
  onSeparate,
  canSeparate,
  results,
}: {
  initialInput: string;
  sourceState: StemsGeneratorSourceState;
  sourceError?: string;
  onLoadYouTube(input: string): void;
  onChooseLocalFile(file: File): void;
  onRemoveSource(): void;
  onSaveSource(): void;
  configuration: SeparationConfiguration;
  onConfigurationChange(configuration: SeparationConfiguration): void;
  modelFiles: {
    name: ModelFilename;
    ready: boolean;
    error?: string;
    downloadUrl: string;
  }[];
  modelStorageError?: string;
  onChooseModelFiles(files: File[], expected?: ModelFilename): void;
  separationPending: boolean;
  separationProgress?: RunProgress;
  separationError?: string;
  onSeparate(): void;
  canSeparate: boolean;
  results?: {
    outputs: { name: string; url: string }[];
    archive: { name: string; url: string };
  };
}) {
  const [input, setInput] = useState(initialInput);
  const source =
    sourceState.status === "ready" ? sourceState.source : undefined;
  const loading = sourceState.status === "loading";
  const loadingPercent =
    loading && sourceState.progress?.totalBytes
      ? Math.round(
          (sourceState.progress.bytesReceived /
            sourceState.progress.totalBytes) *
            100,
        )
      : undefined;

  return (
    <main className="min-h-screen bg-button px-4 py-10 font-sans text-foreground sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Stem generator
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Load a YouTube video or choose a local audio file, then separate it
            into stems in your browser.
          </p>
        </header>

        <div className="grid gap-5">
          <Section
            number="1"
            title="Choose audio"
            description="Use a YouTube video or an audio file from your computer."
          >
            {source ? (
              <SelectedSource
                source={source}
                onSave={onSaveSource}
                onRemove={onRemoveSource}
                disabled={separationPending}
              />
            ) : (
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
                      disabled={loading}
                      onChange={(event) => setInput(event.target.value)}
                    />
                  </label>
                  <button
                    className="h-11 cursor-pointer rounded-md bg-accent px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-60"
                    type="submit"
                    disabled={loading}
                  >
                    {loading
                      ? loadingPercent === undefined
                        ? "Loading..."
                        : `Loading ${loadingPercent}%`
                      : "Load from YouTube"}
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>or use a local file</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <input
                  className="w-full cursor-pointer rounded-md border border-dashed border-button-border bg-button p-2.5 text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                  type="file"
                  accept="audio/*"
                  disabled={loading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    onChooseLocalFile(file);
                  }}
                />
                {sourceError && (
                  <p className="mt-3 text-sm text-error" role="alert">
                    {sourceError}
                  </p>
                )}
              </>
            )}
          </Section>

          <Section number="2" title="Configure">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Model">
                <select
                  className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm"
                  value={configuration.model}
                  disabled={separationPending}
                  onChange={(event) =>
                    onConfigurationChange({
                      ...configuration,
                      model: event.target
                        .value as SeparationConfiguration["model"],
                    })
                  }
                >
                  <option value="htdemucs_ft">htdemucs_ft</option>
                  <option value="htdemucs">htdemucs</option>
                </select>
              </Field>
              <Field label="Shifts">
                <input
                  className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm"
                  type="number"
                  min="1"
                  max="4"
                  value={configuration.shifts}
                  disabled={separationPending}
                  onChange={(event) =>
                    onConfigurationChange({
                      ...configuration,
                      shifts: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Two stems">
                <select
                  className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm"
                  value={configuration.twoStems ?? ""}
                  disabled={separationPending}
                  onChange={(event) =>
                    onConfigurationChange({
                      ...configuration,
                      twoStems: (event.target.value ||
                        null) as SeparationConfiguration["twoStems"],
                    })
                  }
                >
                  <option value="">off</option>
                  <option value="bass">bass</option>
                  <option>vocals</option>
                  <option>drums</option>
                  <option>other</option>
                </select>
              </Field>
              <Field label="Method">
                <select
                  className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm disabled:opacity-50"
                  value={configuration.method}
                  disabled={!configuration.twoStems || separationPending}
                  onChange={(event) =>
                    onConfigurationChange({
                      ...configuration,
                      method: event.target
                        .value as SeparationConfiguration["method"],
                    })
                  }
                >
                  <option value="minus">minus</option>
                  <option value="add">add</option>
                </select>
              </Field>
            </div>
            <p className="mt-4 rounded-md bg-button px-3 py-2.5 text-sm text-muted-foreground">
              {configuration.twoStems ? (
                <>
                  Creates{" "}
                  <strong className="text-foreground">backing.wav</strong> and{" "}
                  <strong className="text-foreground">
                    {configuration.twoStems}.wav
                  </strong>
                  .
                </>
              ) : (
                <>Creates vocals, drums, bass, and other stems.</>
              )}
            </p>
          </Section>

          <Section
            number="3"
            title="Add models"
            description="Model files are stored in this browser after the first setup."
          >
            <div className="grid gap-2.5">
              {modelFiles.map((modelFile) => (
                <ModelRow
                  key={modelFile.name}
                  {...modelFile}
                  disabled={separationPending}
                  onChoose={(files) =>
                    onChooseModelFiles(files, modelFile.name)
                  }
                />
              ))}
            </div>
            <label className="mt-4 inline-block cursor-pointer text-sm font-semibold text-accent hover:underline">
              Choose multiple model files
              <input
                className="sr-only"
                type="file"
                accept=".bin,.onnx"
                multiple
                disabled={separationPending}
                onChange={(event) => {
                  onChooseModelFiles([...(event.target.files ?? [])]);
                  event.target.value = "";
                }}
              />
            </label>
            {modelStorageError && (
              <p className="mt-3 text-sm text-error" role="alert">
                {modelStorageError}
              </p>
            )}
          </Section>

          <Section number="4" title="Separate">
            <button
              className="h-13 w-full cursor-pointer rounded-md bg-accent text-sm font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-40"
              type="button"
              disabled={!canSeparate || separationPending}
              onClick={onSeparate}
            >
              {separationPending ? "Separating..." : "Separate track"}
            </button>
            {!canSeparate && !separationPending && (
              <p className="mt-3 text-sm text-muted-foreground">
                Choose audio and add all required models before starting.
              </p>
            )}
            {separationProgress && (
              <SeparationProgress progress={separationProgress} />
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
      </div>
    </main>
  );
}

function SelectedSource({
  source,
  onSave,
  onRemove,
  disabled,
}: {
  source: StemsGeneratorSource;
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
          {source.kind} / {source.detail}
        </p>
      </div>
      <div className="ml-12 flex w-full items-center gap-3 sm:ml-0 sm:w-auto">
        {source.kind === "YouTube" && (
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModelRow({
  name,
  ready,
  error,
  downloadUrl,
  disabled,
  onChoose,
}: {
  name: ModelFilename;
  ready: boolean;
  error?: string;
  downloadUrl: string;
  disabled: boolean;
  onChoose(files: File[]): void;
}) {
  return (
    <div>
      <div className="flex min-h-13 items-center gap-3 rounded-md border border-button-border bg-button px-4 py-3">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${ready ? "bg-accent text-white" : "border border-button-border text-muted-foreground"}`}
          aria-hidden="true"
        >
          {ready ? "✓" : "+"}
        </span>
        <code className="min-w-0 flex-1 truncate text-sm font-semibold">
          {name}
        </code>
        <a
          className="text-sm font-semibold text-accent hover:underline"
          href={downloadUrl}
        >
          Download
        </a>
        <label className="cursor-pointer text-sm font-semibold text-accent hover:underline">
          {ready ? "Ready" : "Choose"}
          <input
            className="sr-only"
            type="file"
            accept={name.endsWith(".onnx") ? ".onnx" : ".bin"}
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

function StemRow({
  name,
  url,
  source,
}: {
  name: string;
  url: string;
  source: string | null;
}) {
  const label =
    name === "backing" && source ? `Backing track without ${source}` : name;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border bg-button p-4">
      <div>
        <h3 className="font-semibold capitalize">{label}</h3>
      </div>
      <a
        className="cursor-pointer text-sm font-semibold text-accent hover:underline"
        href={url}
        download={`${name}.wav`}
      >
        Download WAV
      </a>
      <audio className="col-span-full w-full" controls src={url} />
    </div>
  );
}

function SeparationProgress({ progress }: { progress: RunProgress }) {
  const percent =
    progress.total > 0 ? Math.round((100 * progress.done) / progress.total) : 0;
  const title =
    progress.phase === "loading"
      ? "Loading model"
      : progress.phase === "separating"
        ? "Separating track"
        : progress.phase === "finalizing"
          ? "Finalizing stems"
          : "Preparing browser runtime";
  return (
    <div className="mt-5 grid gap-2 border-t border-border pt-5">
      <div className="flex justify-between gap-4 text-sm font-semibold">
        <span>{title}</span>
        <span>{percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Overall separation progress"
        aria-valuemin={0}
        aria-valuemax={Math.max(progress.total, 1)}
        aria-valuenow={progress.done}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      {progress.currentModel && (
        <p className="text-xs text-muted-foreground">
          {progress.currentModel.modelTotal > 1 &&
            `Model ${progress.currentModel.index}/${progress.currentModel.modelTotal} / `}
          {progress.currentModel.file} / {progress.currentModel.done}/
          {progress.currentModel.total} chunks
        </p>
      )}
    </div>
  );
}

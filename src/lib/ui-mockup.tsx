import { useState } from "react";

type MockSource = {
  kind: "YouTube" | "Local file";
  name: string;
  detail: string;
};

export function UiMockup() {
  const [input, setInput] = useState(
    "https://www.youtube.com/watch?v=YsmSk0cZa6w",
  );
  const [source, setSource] = useState<MockSource>();
  const [complete, setComplete] = useState(false);

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
                    >
                      Save source audio
                    </button>
                  )}
                  <button
                    className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-button-hover hover:text-foreground"
                    type="button"
                    aria-label="Remove source"
                    title="Remove source"
                    onClick={() => {
                      setSource(undefined);
                      setComplete(false);
                    }}
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
            ) : (
              <>
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSource({
                      kind: "YouTube",
                      name: "Example YouTube track",
                      detail: "Example channel / 4:32 / 38.4 MB",
                    });
                    setComplete(false);
                  }}
                >
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">YouTube video ID or URL</span>
                    <input
                      className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm outline-none focus:border-accent-border"
                      value={input}
                      placeholder="YouTube video ID or URL"
                      onChange={(event) => setInput(event.target.value)}
                    />
                  </label>
                  <button
                    className="h-11 cursor-pointer rounded-md bg-accent px-5 text-sm font-semibold text-white hover:opacity-90"
                    type="submit"
                  >
                    Load from YouTube
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
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    setSource({
                      kind: "Local file",
                      name: file.name,
                      detail: `${(file.size / 1_000_000).toFixed(1)} MB`,
                    });
                    setComplete(false);
                  }}
                />
              </>
            )}
          </Section>

          <Section number="2" title="Configure">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Model">
                <select className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm">
                  <option>htdemucs_ft</option>
                  <option>htdemucs</option>
                </select>
              </Field>
              <Field label="Shifts">
                <input
                  className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm"
                  type="number"
                  min="1"
                  max="4"
                  defaultValue="1"
                />
              </Field>
              <Field label="Two stems">
                <select className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm">
                  <option>bass</option>
                  <option>vocals</option>
                  <option>drums</option>
                  <option>other</option>
                  <option>off</option>
                </select>
              </Field>
              <Field label="Method">
                <select className="h-11 w-full rounded-md border border-button-border bg-panel px-3 text-sm">
                  <option>minus</option>
                  <option>add</option>
                </select>
              </Field>
            </div>
            <p className="mt-4 rounded-md bg-button px-3 py-2.5 text-sm text-muted-foreground">
              Creates <strong className="text-foreground">bass.wav</strong> and{" "}
              <strong className="text-foreground">backing.wav</strong>.
            </p>
          </Section>

          <Section
            number="3"
            title="Add models"
            description="Model files are stored in this browser after the first setup."
          >
            <div className="grid gap-2.5">
              <ModelRow name="dft.bin" />
              <ModelRow name="htdemucs_ft_bass.onnx" />
            </div>
          </Section>

          <Section number="4" title="Separate">
            <button
              className="h-13 w-full cursor-pointer rounded-md bg-accent text-sm font-semibold text-white hover:opacity-90 disabled:cursor-default disabled:opacity-40"
              type="button"
              disabled={!source}
              onClick={() => setComplete(true)}
            >
              Separate track
            </button>
            {!source && (
              <p className="mt-3 text-sm text-muted-foreground">
                Choose audio before starting separation.
              </p>
            )}
          </Section>

          {complete && (
            <section className="rounded-xl border border-border bg-panel p-5 shadow-lg sm:p-7">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-accent uppercase">
                    Separation complete
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">Your stems</h2>
                </div>
                <button
                  className="cursor-pointer text-sm font-semibold text-accent hover:underline"
                  type="button"
                >
                  Download ZIP
                </button>
              </div>
              <div className="grid gap-3">
                <StemRow name="Backing track" detail="without bass" />
                <StemRow name="Bass" detail="isolated stem" />
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
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

function ModelRow({ name }: { name: string }) {
  return (
    <div className="flex min-h-13 items-center gap-3 rounded-md border border-button-border bg-button px-4 py-3">
      <span
        className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white"
        aria-hidden="true"
      >
        <svg
          className="size-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m3 8 3 3 7-7" />
        </svg>
      </span>
      <code className="min-w-0 flex-1 truncate text-sm font-semibold">
        {name}
      </code>
      <span className="text-sm font-semibold text-accent">Ready</span>
    </div>
  );
}

function StemRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border bg-button p-4">
      <div>
        <h3 className="font-semibold">{name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <button
        className="cursor-pointer text-sm font-semibold text-accent hover:underline"
        type="button"
      >
        Download WAV
      </button>
      <div className="col-span-full h-8 rounded-full border border-button-border bg-panel" />
    </div>
  );
}

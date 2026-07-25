export type ExtensionView = "generator" | "saved";

export function ExtensionPageView({
  view,
  viewHrefs,
  onViewChange,
  children,
}: {
  view: ExtensionView;
  viewHrefs: Record<ExtensionView, string>;
  onViewChange(view: ExtensionView): void;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-button px-4 py-10 font-sans text-foreground sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <AppHeader
          view={view}
          viewHrefs={viewHrefs}
          onViewChange={onViewChange}
        />
        {children}
      </div>
    </main>
  );
}

function AppHeader({
  view,
  viewHrefs,
  onViewChange,
}: {
  view: ExtensionView;
  viewHrefs: Record<ExtensionView, string>;
  onViewChange(view: ExtensionView): void;
}) {
  const saved = view === "saved";

  return (
    <header className="mb-8 max-w-[760px]">
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">
          Stem Mixer for YouTube
        </p>
        <a
          className="ml-auto text-sm font-semibold text-foreground underline underline-offset-3 hover:text-accent"
          href="https://github.com/hi-ogawa/youtube-audio-replacement"
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
      </div>
      <nav
        className="mb-7 flex gap-1 border-b border-border"
        aria-label="Stem Mixer"
      >
        <NavLink
          active={!saved}
          href={viewHrefs.generator}
          onClick={() => onViewChange("generator")}
        >
          Generate stems
        </NavLink>
        <NavLink
          active={saved}
          href={viewHrefs.saved}
          onClick={() => onViewChange("saved")}
        >
          Saved videos
        </NavLink>
      </nav>
      <h1 className="text-4xl leading-tight font-semibold tracking-[-0.035em] sm:text-5xl">
        {saved ? "Saved videos" : "Stem generator"}
      </h1>
      <p className="mt-4 mb-2 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        {saved
          ? "Review the YouTube videos with replacement audio stored on this device."
          : "Load a YouTube video or choose a local audio file, then separate it into stems in your browser. Your audio and model files stay on this device."}
      </p>
    </header>
  );
}

function NavLink({
  active,
  children,
  href,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
  onClick(): void;
}) {
  return (
    <a
      className={`relative -mb-px cursor-pointer border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </a>
  );
}

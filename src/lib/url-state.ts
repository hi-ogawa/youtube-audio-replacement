import { useEffect, useState } from "react";

export function useSearchParam(name: string) {
  const [value, setValue] = useState(() => readSearchParam(name));

  useEffect(() => {
    const syncValue = () => setValue(readSearchParam(name));
    window.addEventListener("popstate", syncValue);
    return () => window.removeEventListener("popstate", syncValue);
  }, [name]);

  function navigate(nextValue: string | null) {
    const url = withSearchParam(location.href, name, nextValue);
    history.pushState({}, "", url);
    setValue(nextValue);
  }

  return [value, navigate] as const;
}

function readSearchParam(name: string) {
  return new URL(location.href).searchParams.get(name);
}

export function withSearchParam(
  href: string,
  name: string,
  value: string | null,
) {
  const url = new URL(href);
  if (value === null) {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  return url.href;
}

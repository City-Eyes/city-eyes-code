import { useEffect, useState, type ComponentType } from 'react';

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

// This design-system entry loads only its own mockups and theme.
const modules = import.meta.glob('./mockups/**/*.tsx') as ModuleMap;

function resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const functions = Object.values(mod).filter(
    (value) => typeof value === 'function',
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    functions[functions.length - 1]
  );
}

function PreviewRenderer({ componentPath }: { componentPath: string }) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setComponent(null);
    setError(null);

    async function loadComponent() {
      const loader = modules[`./mockups/${componentPath}.tsx`];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      try {
        const module = await loader();
        if (cancelled) return;
        const name = componentPath.split('/').pop()!;
        const resolved = resolveComponent(module, name);
        if (!resolved) {
          setError(`No exported React component found in ${componentPath}.tsx`);
          return;
        }
        setComponent(() => resolved);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    }

    void loadComponent();
    return () => {
      cancelled = true;
    };
  }, [componentPath]);

  if (error) {
    return (
      <pre className="p-8 text-destructive" role="alert">
        {error}
      </pre>
    );
  }
  return Component ? <Component /> : null;
}

function App() {
  const [componentPath, setComponentPath] = useState(() =>
    window.location.hash.replace(/^#\/?/, '').replace(/\/$/, ''),
  );

  useEffect(() => {
    const onHashChange = () =>
      setComponentPath(window.location.hash.replace(/^#\/?/, '').replace(/\/$/, ''));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!componentPath) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <p className="text-muted-foreground">
          Abra a prévia CITY EYES pelo link do componente.
        </p>
      </main>
    );
  }
  return <PreviewRenderer componentPath={componentPath} />;
}

export default App;

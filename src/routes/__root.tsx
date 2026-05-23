import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <Link to="/" className="mt-6 inline-block text-primary underline">Voltar ao início</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >Tentar novamente</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ResidMed — Banco de Questões" },
      { name: "description", content: "Banco pessoal de questões de residência médica" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function Header() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-serif text-xl font-semibold tracking-tight">
          Resid<span className="text-primary">Med</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" activeOptions={{ exact: true }} className="rounded px-3 py-1.5 hover:bg-muted [&.active]:bg-muted [&.active]:font-medium">Início</Link>
          <Link to="/bank" className="rounded px-3 py-1.5 hover:bg-muted [&.active]:bg-muted [&.active]:font-medium">Banco</Link>
          <Link to="/exam" className="rounded px-3 py-1.5 hover:bg-muted [&.active]:bg-muted [&.active]:font-medium">Prova</Link>
          <Link to="/notes" className="rounded px-3 py-1.5 hover:bg-muted [&.active]:bg-muted [&.active]:font-medium">Anotações</Link>
          <Link to="/settings" className="rounded px-3 py-1.5 hover:bg-muted [&.active]:bg-muted [&.active]:font-medium">Configurações</Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-2 rounded px-3 py-1.5 text-muted-foreground hover:bg-muted"
          >Sair</button>
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthCacheSync />
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <Outlet />
        </div>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthCacheSync() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries();
      router.invalidate();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);
  return null;
}

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
  name?: string;
  componentStack?: string;
}

/** Avoid secondary failures when console is overridden or unavailable. */
function safeConsoleError(...args: unknown[]): void {
  try {
     
    console.error(...args);
  } catch {
    // ignore
  }
}

function sameOriginHealthUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/v1/health`;
  }
  return "/api/v1/health";
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "An unexpected error occurred.",
      name: error?.name || "Error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const stack = info?.componentStack?.trim() || undefined;
    safeConsoleError("[FarmacoGraph Studio] Uncaught render error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      componentStack: stack,
    });
    this.setState({ componentStack: stack });
  }

  private recover = () => {
    this.setState({
      hasError: false,
      message: undefined,
      name: undefined,
      componentStack: undefined,
    });
  };

  private reload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const healthUrl = sameOriginHealthUrl();
      const summary = [this.state.name, this.state.message].filter(Boolean).join(": ");

      return (
        <div className="flex min-h-[50vh] items-center justify-center bg-background p-6">
          <Card className="w-full max-w-lg border-destructive/30">
            <CardHeader>
              <CardTitle>Studio hit an unexpected error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The page failed to render. This is usually a client-side crash (bad data, broken
                chunk, or auth edge case) — not a silent white screen from nginx.
              </p>
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-foreground whitespace-pre-wrap break-words">
                {summary}
              </pre>
              {this.state.componentStack ? (
                <details className="rounded-md border bg-muted/20 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-foreground">
                    Component stack (safe to share with engineering)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap break-words">
                    {this.state.componentStack}
                  </pre>
                </details>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={this.recover}>
                  Try again
                </Button>
                <Button type="button" variant="secondary" onClick={this.reload}>
                  Reload page
                </Button>
                <Button type="button" variant="outline" asChild>
                  <a href={healthUrl} target="_blank" rel="noreferrer">
                    Open API health
                  </a>
                </Button>
              </div>
              <p className="text-xs">
                If this keeps happening after a deploy, run{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
                  ./scripts/smoke-studio.sh
                </code>{" "}
                and check Studio logs.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

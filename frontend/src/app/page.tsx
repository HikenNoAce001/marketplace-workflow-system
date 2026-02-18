import Link from "next/link";

/**
 * Landing page — the first thing users see at "/".
 * Clean, centered layout with a CTA to get started.
 * Redirects to the login page where users can sign in.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Marketplace Workflow System
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          A role-based project marketplace where buyers create projects and
          problem solvers deliver results.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}

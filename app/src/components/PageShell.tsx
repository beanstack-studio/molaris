/**
 * PageShell - Standardized page wrapper for all main menu pages
 * Provides consistent outer structure: page-content > page-sections
 */

interface PageShellProps {
  children: React.ReactNode;
  error?: string | null;
}

export function PageShell({ children, error }: PageShellProps) {
  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="page-content">
        <div className="page-sections">{children}</div>
      </div>
    </>
  );
}

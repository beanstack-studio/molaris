/**
 * PageShell - Standardized page wrapper for all main menu pages
 * Provides consistent outer structure: patient-content > patient-sections
 */

interface PageShellProps {
  children: React.ReactNode;
  error?: string | null;
}

export function PageShell({ children, error }: PageShellProps) {
  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="patient-content">
        <div className="patient-sections">{children}</div>
      </div>
    </>
  );
}

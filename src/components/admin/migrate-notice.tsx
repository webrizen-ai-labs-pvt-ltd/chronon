import { Alert } from "./kit";

/** Shown when the builder tables haven't been created on this database yet. */
export function MigrateNotice() {
  return (
    <Alert tone="warning" title="The API builder needs a database migration">
      Run <code className="font-mono">pnpm db:migrate</code> against this environment&apos;s database to create the builder tables. Until then, built-in
      APIs keep serving from code.
    </Alert>
  );
}

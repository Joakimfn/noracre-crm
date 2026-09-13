/** Customer employees use Bruker, customer managers Administrator, Noracre Superadmin. */
export const canManageModules = (role: string) =>
  role === "Administrator" || role === "Superadmin";

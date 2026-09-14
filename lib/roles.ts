/** Customer employees use Bruker, customer managers Administrator, Noracre Superadmin. */
export const canManageModules = (role: string) =>
  role === "Administrator" || role === "Superadmin";

export const canViewAdministration = (role: string) =>
  role === "Administrator" || role === "Superadmin";

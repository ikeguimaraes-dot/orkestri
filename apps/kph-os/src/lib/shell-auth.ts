import type { CurrentUser } from "@kph/auth/server";

export const SHELL_USER: CurrentUser = {
  id: "shell-gate",
  email: "ike@kph.os",
  displayName: "Ike",
  roles: [{ role: "founder", unitId: null, brandId: null, groupId: null }],
  categories: [], // founder: bypass no client, não precisa popular.
};

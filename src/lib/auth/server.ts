import "server-only";
import { cache } from "react";
import type { RoleName } from "@/types/database";

export type CurrentUser = {
  id: string;
  email: string | null;
  roles: Array<{
    role: RoleName;
    unitId: string | null;
    brandId: string | null;
    groupId: string | null;
  }>;
};

// TEMP: auth mockado para testes de Ponto — restaurar antes de produção real
const MOCK_USER: CurrentUser = {
  id: "ac559fa1-f10b-4ec4-9f4b-fafbc881a884",
  email: "ikeguimaraes@gmail.com",
  roles: [{ role: "founder" as RoleName, unitId: null, brandId: null, groupId: null }],
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  return MOCK_USER;
});

export async function requireUser(): Promise<CurrentUser> {
  return MOCK_USER;
}

export async function requireRole(_allowed: ReadonlyArray<RoleName>): Promise<CurrentUser> {
  return MOCK_USER;
}

export function isFounder(_user: CurrentUser | null): boolean {
  return true;
}

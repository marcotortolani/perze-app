/**
 * CQ — un UPDATE local se armó sobre `client_rev = payload.clientRev - 1`
 * (la revisión que el cliente tenía cuando empezó a editar). Si el
 * servidor ya está en otra revisión distinta de esa base, alguien más
 * escribió esta misma fila en el medio — conflicto real, no hay forma
 * segura de aplicar el update tal cual.
 */
export function detectRevisionConflict(localClientRev: number, serverClientRev: number | null): boolean {
  if (serverClientRev === null) return false; // la fila no existe todavía en el servidor — no es un conflicto de revisión
  const baseRev = localClientRev - 1;
  return serverClientRev !== baseRev;
}

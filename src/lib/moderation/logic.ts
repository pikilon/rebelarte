// Lógica pura de moderación y denuncias.
import type { ModerationAction, ReportReason, ReportTarget } from '$lib/types';

export const REPORT_REASONS: readonly ReportReason[] = ['copyright', 'image_rights', 'minors', 'offensive', 'spam', 'other'];
export const REPORT_DETAILS_MAX = 2000;
export const NOTE_MIN = 3;
export const NOTE_MAX = 1000;

export type ReportProblem = 'reason' | 'details' | 'tooLong' | null;

/** El motivo es obligatorio; con «otros» los detalles también. */
export function validateReport(reason: ReportReason | '' | null, details: string): ReportProblem {
  if (!reason) return 'reason';
  if (details.length > REPORT_DETAILS_MAX) return 'tooLong';
  if (reason === 'other' && details.trim().length < NOTE_MIN) return 'details';
  return null;
}

export function validateNote(note: string): 'empty' | 'tooLong' | null {
  const n = note.trim().length;
  if (n < NOTE_MIN) return 'empty';
  if (n > NOTE_MAX) return 'tooLong';
  return null;
}

export interface ActionSpec {
  action: ModerationAction;
  /** Tipo y id sobre los que se aplica (p. ej. suspender al subidor de una obra denunciada). */
  targetType: ReportTarget;
  targetId: string;
  /** Clave i18n de la etiqueta. */
  label: string;
  destructive: boolean;
}

/**
 * Acciones disponibles para una denuncia según el tipo de objetivo.
 * ownerId: autor del objetivo (subidor de la obra, emisor del mensaje) para poder suspenderlo.
 */
export function actionsFor(targetType: ReportTarget, targetId: string, ownerId?: string | null): ActionSpec[] {
  const spec = (action: ModerationAction, tt: ReportTarget, id: string, destructive: boolean): ActionSpec => ({
    action, targetType: tt, targetId: id, label: `mod.action.${action}`, destructive
  });
  const out: ActionSpec[] = [];
  switch (targetType) {
    case 'work':
      out.push(spec('hide', 'work', targetId, false), spec('restore', 'work', targetId, false), spec('delete', 'work', targetId, true));
      break;
    case 'profile':
      out.push(spec('suspend_user', 'profile', targetId, true), spec('unsuspend_user', 'profile', targetId, false));
      break;
    // La BD solo admite borrar adjuntos, mensajes y premios (y verificar premios).
    case 'attachment':
    case 'message':
      out.push(spec('delete', targetType, targetId, true));
      break;
    case 'award':
      out.push(spec('verify_award', 'award', targetId, false), spec('delete', 'award', targetId, true));
      break;
  }
  if (ownerId && targetType !== 'profile') {
    out.push(spec('suspend_user', 'profile', ownerId, true));
  }
  out.push(spec('dismiss_report', targetType, targetId, false));
  return out;
}

export function isDestructive(action: ModerationAction): boolean {
  return action === 'delete' || action === 'suspend_user';
}

/** Argumentos de la RPC moderate para una acción. */
export function moderateArgs(spec: Pick<ActionSpec, 'action' | 'targetType' | 'targetId'>, note: string, reportId: string | null) {
  return {
    p_target_type: spec.targetType,
    p_target_id: spec.targetId,
    p_action: spec.action,
    p_note: note.trim(),
    p_report_id: reportId
  };
}

export function reportKey(r: { target_type: ReportTarget; target_id: string }): string {
  return `${r.target_type}:${r.target_id}`;
}

/** Agrupa ids por tipo de objetivo sin repetidos. */
export function idsByTarget(items: readonly { target_type: ReportTarget; target_id: string }[]): Record<ReportTarget, string[]> {
  const out: Record<ReportTarget, Set<string>> = {
    work: new Set(), profile: new Set(), attachment: new Set(), message: new Set(), award: new Set()
  };
  for (const i of items) out[i.target_type].add(i.target_id);
  return {
    work: [...out.work], profile: [...out.profile], attachment: [...out.attachment],
    message: [...out.message], award: [...out.award]
  };
}

/**
 * The ticket lifecycle (#061).
 *
 *   NEW ──(admin opens the detail)──▶ IN_PROGRESS ──(admin marks it)──▶ RESOLVED
 *                                                                          │
 *                                                        (48h with no reply)│
 *                                                                          ▼
 *                                                                        CLOSED
 *
 * A reply from either side pulls a CLOSED ticket back to NEW — that behaviour
 * predates this (#032) and is what makes the auto-close safe: closing early is
 * recoverable by simply writing back.
 *
 * The stored values are unchanged, so nothing that filters or reports on them
 * breaks; `open` is what the CMS already labels "Mới".
 */
export const TicketStatus = {
  NEW: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type TicketStatusValue =
  (typeof TicketStatus)[keyof typeof TicketStatus];

/**
 * How long a resolved ticket waits before closing itself (#061).
 *
 * 48 hours is the window the customer has to say "actually, still broken" — their
 * reply reopens it, so this is a grace period rather than a deadline.
 */
export const TICKET_AUTO_CLOSE_HOURS = 48;

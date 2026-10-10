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
  /**
   * "Cần bổ sung thông tin" — waiting on the customer, set by hand (#041, test
   * round 4). The customer's answer moves it back to IN_PROGRESS.
   */
  NEED_INFO: 'need_info',
} as const;

/** Who wrote the latest message on a ticket (#041, test round 4). */
export type TicketReplyRole = 'customer' | 'admin';

export type TicketStatusValue =
  (typeof TicketStatus)[keyof typeof TicketStatus];

/**
 * How long a resolved ticket waits before closing itself (#061).
 *
 * 48 hours is the window the customer has to say "actually, still broken" — their
 * reply reopens it, so this is a grace period rather than a deadline.
 */
export const TICKET_AUTO_CLOSE_HOURS = 48;

/**
 * A ticket's status once someone has written in it (#041, test round 4).
 *
 * The customer writing back: RESOLVED and NEED_INFO go back to IN_PROGRESS (it
 * is not done, or the missing information has arrived); NEW and IN_PROGRESS
 * stay; CLOSED stays closed — they are asked to open a new request instead.
 * Support writing in a closed ticket picks it back up as IN_PROGRESS.
 */
export function nextStatusAfterReply(
  current: string,
  author: TicketReplyRole,
): TicketStatusValue {
  const status = current as TicketStatusValue;
  if (author === 'customer') {
    if (status === TicketStatus.RESOLVED || status === TicketStatus.NEED_INFO) {
      return TicketStatus.IN_PROGRESS;
    }
    return status;
  }
  return status === TicketStatus.CLOSED ? TicketStatus.IN_PROGRESS : status;
}

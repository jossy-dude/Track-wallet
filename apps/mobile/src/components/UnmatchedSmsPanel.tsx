import { MaterialSymbol } from "@omni-sync/ui";

export interface UnmatchedSmsPreview {
  id: string;
  senderLabel: string;
  smsBody: string;
  receivedAtLabel: string;
  capturedAtLabel: string;
}

interface UnmatchedSmsPanelProps {
  messages: readonly UnmatchedSmsPreview[];
  onDismissMessage?: (message: UnmatchedSmsPreview) => void;
}

export function UnmatchedSmsPanel({
  messages,
  onDismissMessage,
}: UnmatchedSmsPanelProps) {
  return (
    <section className="rounded-[24px] border border-surface-container bg-surface-container-lowest p-4 shadow-[0_4px_20px_rgba(46,50,48,0.06)]">
      <div className="mb-4 space-y-1 px-2">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          Needs Parser Review
        </h3>
        <p className="text-sm text-on-surface-variant">
          Raw SMS messages that did not match the current deterministic templates.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {messages.length > 0 ? (
          messages.map((message) => (
            <article
              className="rounded-2xl bg-surface-container-low p-4"
              key={message.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    <MaterialSymbol className="text-[16px]" name="sms_failed" />
                    {message.senderLabel}
                  </div>
                  <p className="rounded-2xl bg-surface-container px-3 py-3 text-sm leading-6 text-on-surface">
                    {message.smsBody}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium uppercase tracking-[0.12em] text-outline">
                    <span>Received {message.receivedAtLabel}</span>
                    <span>Captured {message.capturedAtLabel}</span>
                  </div>
                </div>

                {onDismissMessage ? (
                  <button
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-surface-container text-on-surface active:scale-95"
                    onClick={() => onDismissMessage(message)}
                    type="button"
                  >
                    <MaterialSymbol className="text-[20px]" name="close" />
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
            No unmatched raw SMS messages are waiting for parser review.
          </div>
        )}
      </div>
    </section>
  );
}

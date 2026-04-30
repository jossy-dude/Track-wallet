import { useMemo } from "react";

import {
  parseIncomingSMS,
  parseSmsMessage,
  type ParserMatchResult,
  type RawSmsMessage,
} from "@omni-sync/core";
import { useTransactionStore } from "@omni-sync/database";

export interface DebugSmsInput {
  address: string;
  body: string;
  timestamp_ms: number;
}

export interface QueuedParseResult {
  status: "queued";
  queueEntryId: string;
}

export interface UseParserResult {
  previewResult: ParserMatchResult;
  parseAndQueue: (
    input: DebugSmsInput,
  ) => QueuedParseResult | ParserMatchResult;
}

export function useParser(
  rawSmsBody = "",
  senderLabel = "manual-preview",
): UseParserResult {
  const queueParsedTransaction = useTransactionStore(
    (state) => state.queueParsedTransaction,
  );

  const previewResult = useMemo(
    () =>
      parseSmsMessage({
        messageId: "parser-preview",
        senderLabel,
        smsBody: rawSmsBody,
        receivedAt: new Date().toISOString(),
      }),
    [rawSmsBody, senderLabel],
  );

  function parseAndQueue(input: DebugSmsInput) {
    const rawSmsMessage: RawSmsMessage = {
      messageId: `debug-${input.timestamp_ms}`,
      senderLabel: input.address,
      smsBody: input.body,
      receivedAt: new Date(input.timestamp_ms).toISOString(),
    };

    const parseResult = parseIncomingSMS(rawSmsMessage);
    console.log("[Parser] parseAndQueue input", rawSmsMessage);
    console.log("[Parser] parseAndQueue result", parseResult);
    if (parseResult.status !== "matched") {
      return parseResult;
    }

    const queueEntry = queueParsedTransaction(
      parseResult.draft,
      rawSmsMessage.receivedAt,
    );

    return {
      status: "queued" as const,
      queueEntryId: queueEntry.queueEntryId,
    };
  }

  return {
    previewResult,
    parseAndQueue,
  };
}

import { useMemo } from "react";

import {
  parseIncomingSMS,
  parseSmsMessage,
  type ParserMatchResult,
  type ParserRuntimeOptions,
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

export interface CapturedUnmatchedParseResult {
  status: "unmatched_captured";
  unmatchedEntryId: string;
}

export interface UseParserResult {
  previewResult: ParserMatchResult;
  parseAndQueue: (
    input: DebugSmsInput,
  ) => QueuedParseResult | CapturedUnmatchedParseResult;
}

export interface UseParserOptions {
  runtime?: ParserRuntimeOptions;
  verboseLogging?: boolean;
}

function buildRedactedDebugPayload(message: RawSmsMessage) {
  return {
    messageId: message.messageId,
    senderLabel: message.senderLabel,
    receivedAt: message.receivedAt,
    bodyLength: message.smsBody.length,
  };
}

export function useParser(
  rawSmsBody = "",
  senderLabel = "manual-preview",
  options: UseParserOptions = {},
): UseParserResult {
  const queueParsedTransaction = useTransactionStore(
    (state) => state.queueParsedTransaction,
  );
  const captureUnmatchedSms = useTransactionStore(
    (state) => state.captureUnmatchedSms,
  );

  const previewResult = useMemo(
    () =>
      parseSmsMessage({
        messageId: "parser-preview",
        senderLabel,
        smsBody: rawSmsBody,
        receivedAt: new Date().toISOString(),
      }, options.runtime),
    [options.runtime, rawSmsBody, senderLabel],
  );

  function parseAndQueue(input: DebugSmsInput) {
    const rawSmsMessage: RawSmsMessage = {
      messageId: `debug-${input.timestamp_ms}`,
      senderLabel: input.address,
      smsBody: input.body,
      receivedAt: new Date(input.timestamp_ms).toISOString(),
    };

    const parseResult = parseIncomingSMS(rawSmsMessage, options.runtime);
    if (options.verboseLogging) {
      console.log(
        "[Parser] parseAndQueue input",
        buildRedactedDebugPayload(rawSmsMessage),
      );
      console.log("[Parser] parseAndQueue result", {
        status: parseResult.status,
        matchedTemplateId:
          parseResult.status === "matched" ? parseResult.draft.parserTemplateId : null,
      });
    }
    if (parseResult.status !== "matched") {
      const unmatchedEntry = captureUnmatchedSms(
        rawSmsMessage,
        parseResult,
        rawSmsMessage.receivedAt,
      );

      return {
        status: "unmatched_captured" as const,
        unmatchedEntryId: unmatchedEntry.unmatchedEntryId,
      };
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

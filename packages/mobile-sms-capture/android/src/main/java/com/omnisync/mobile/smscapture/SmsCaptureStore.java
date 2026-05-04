package com.omnisync.mobile.smscapture;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONException;
import org.json.JSONObject;

final class SmsCaptureStore {

    private static final String PREFERENCES_NAME = "trackwallet.mobile.smscapture";
    private static final String KEY_CAPTURE_ENABLED = "capture_enabled";
    private static final String KEY_QUEUE = "queue";
    private static final String KEY_DIAGNOSTICS = "diagnostics";

    private final SharedPreferences preferences;

    SmsCaptureStore(Context context) {
        this.preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    synchronized JSObject getSnapshot(String permissionState) {
        JSArray queue = readQueue();
        JSObject diagnostics = readDiagnostics();
        decorateDiagnostics(diagnostics, permissionState);
        writeDiagnostics(diagnostics);
        return buildSnapshot(queue, diagnostics, isCaptureEnabled());
    }

    synchronized JSObject setCaptureEnabled(boolean enabled, String permissionState) {
        preferences.edit().putBoolean(KEY_CAPTURE_ENABLED, enabled).apply();
        return getSnapshot(permissionState);
    }

    synchronized JSObject clearRuntimeState(String permissionState) {
        preferences
            .edit()
            .remove(KEY_CAPTURE_ENABLED)
            .remove(KEY_QUEUE)
            .remove(KEY_DIAGNOSTICS)
            .apply();
        return getSnapshot(permissionState);
    }

    synchronized JSObject acknowledgeMessages(JSArray captureIds, String permissionState) {
        Set<String> acknowledgedIds = new HashSet<>();
        for (int index = 0; index < captureIds.length(); index += 1) {
            acknowledgedIds.add(captureIds.optString(index));
        }

        JSArray queue = readQueue();
        JSArray remaining = new JSArray();
        for (int index = 0; index < queue.length(); index += 1) {
            JSObject item = queue.optJSONObject(index) instanceof JSObject
                ? (JSObject) queue.optJSONObject(index)
                : copyObject(queue.optJSONObject(index));
            if (item == null) {
                continue;
            }
            if (!acknowledgedIds.contains(item.optString("captureId"))) {
                remaining.put(item);
            }
        }

        writeQueue(remaining);
        return getSnapshot(permissionState);
    }

    synchronized JSObject captureSms(
        String senderLabel,
        String smsBody,
        long receivedAtMillis,
        String subscriptionId,
        Integer subscriptionSlot
    ) {
        JSObject diagnostics = readDiagnostics();
        decorateDiagnostics(diagnostics, diagnostics.optString("permissionState", "unknown"));

        if (!isCaptureEnabled()) {
            incrementCounter(diagnostics, "filteredOutCount");
            writeDiagnostics(diagnostics);
            return null;
        }

        String compactSender = compactText(senderLabel);
        String compactBody = compactText(smsBody);
        if (compactSender.isEmpty() || compactBody.isEmpty()) {
            incrementCounter(diagnostics, "filteredOutCount");
            writeDiagnostics(diagnostics);
            return null;
        }

        long safeReceivedAtMillis = receivedAtMillis > 0 ? receivedAtMillis : System.currentTimeMillis();
        String receivedAt = formatIsoTimestamp(safeReceivedAtMillis);
        String hash = buildHash(compactSender, compactBody, receivedAt);
        JSArray queue = readQueue();
        if (containsHash(queue, hash)) {
            incrementCounter(diagnostics, "duplicateSuppressedCount");
            writeDiagnostics(diagnostics);
            return null;
        }

        String capturedAt = formatIsoTimestamp(System.currentTimeMillis());
        String messageId = buildMessageId(safeReceivedAtMillis, hash);
        JSObject item = new JSObject();
        item.put("captureId", buildCaptureId(messageId, capturedAt));
        item.put("messageId", messageId);
        item.put("senderLabel", compactSender);
        item.put("smsBody", compactBody);
        item.put("receivedAt", receivedAt);
        item.put("capturedAt", capturedAt);
        item.put("source", "android_sms_receiver");
        item.put("hash", hash);
        item.put("status", "captured");
        item.put("parseAttemptCount", 0);
        if (subscriptionId != null && !subscriptionId.isEmpty()) {
            item.put("subscriptionId", subscriptionId);
        }
        if (subscriptionSlot != null && subscriptionSlot >= 0) {
            item.put("subscriptionSlot", subscriptionSlot);
        }

        JSArray nextQueue = new JSArray();
        nextQueue.put(item);
        for (int index = 0; index < queue.length(); index += 1) {
            nextQueue.put(queue.opt(index));
        }

        putNullable(diagnostics, "lastCapturedAt", capturedAt);
        putNullable(diagnostics, "lastCapturedSenderLabel", compactSender);
        putNullable(diagnostics, "lastFailureReason", null);
        writeQueue(nextQueue);
        writeDiagnostics(diagnostics);
        return item;
    }

    synchronized void recordFailure(String failureReason) {
        JSObject diagnostics = readDiagnostics();
        putNullable(diagnostics, "lastFailureReason", failureReason);
        writeDiagnostics(diagnostics);
    }

    private boolean isCaptureEnabled() {
        return preferences.getBoolean(KEY_CAPTURE_ENABLED, false);
    }

    private JSArray readQueue() {
        String rawQueue = preferences.getString(KEY_QUEUE, null);
        if (rawQueue == null || rawQueue.isEmpty()) {
            return new JSArray();
        }

        try {
            return new JSArray(rawQueue);
        } catch (JSONException error) {
            return new JSArray();
        }
    }

    private void writeQueue(JSArray queue) {
        preferences.edit().putString(KEY_QUEUE, queue.toString()).apply();
    }

    private JSObject readDiagnostics() {
        JSObject diagnostics = createDefaultDiagnostics();
        String rawDiagnostics = preferences.getString(KEY_DIAGNOSTICS, null);
        if (rawDiagnostics == null || rawDiagnostics.isEmpty()) {
            return diagnostics;
        }

        try {
            JSObject stored = new JSObject(rawDiagnostics);
            copyIfPresent(stored, diagnostics, "permissionState");
            copyIfPresent(stored, diagnostics, "nativeCaptureAvailable");
            copyIfPresent(stored, diagnostics, "captureSupported");
            copyIfPresent(stored, diagnostics, "historyCaptureSupported");
            copyIfPresent(stored, diagnostics, "duplicateSuppressedCount");
            copyIfPresent(stored, diagnostics, "filteredOutCount");
            copyIfPresent(stored, diagnostics, "lastCapturedAt");
            copyIfPresent(stored, diagnostics, "lastCapturedSenderLabel");
            copyIfPresent(stored, diagnostics, "lastParserHandoffAt");
            copyIfPresent(stored, diagnostics, "lastParserOutcome");
            copyIfPresent(stored, diagnostics, "lastFailureReason");
            return diagnostics;
        } catch (JSONException error) {
            return diagnostics;
        }
    }

    private void writeDiagnostics(JSObject diagnostics) {
        preferences.edit().putString(KEY_DIAGNOSTICS, diagnostics.toString()).apply();
    }

    private JSObject createDefaultDiagnostics() {
        JSObject diagnostics = new JSObject();
        diagnostics.put("permissionState", "unknown");
        diagnostics.put("nativeCaptureAvailable", true);
        diagnostics.put("captureSupported", true);
        diagnostics.put("historyCaptureSupported", false);
        diagnostics.put("duplicateSuppressedCount", 0);
        diagnostics.put("filteredOutCount", 0);
        putNullable(diagnostics, "lastCapturedAt", null);
        putNullable(diagnostics, "lastCapturedSenderLabel", null);
        putNullable(diagnostics, "lastParserHandoffAt", null);
        diagnostics.put("lastParserOutcome", "idle");
        putNullable(diagnostics, "lastFailureReason", null);
        return diagnostics;
    }

    private void decorateDiagnostics(JSObject diagnostics, String permissionState) {
        diagnostics.put("permissionState", permissionState);
        diagnostics.put("nativeCaptureAvailable", true);
        diagnostics.put("captureSupported", true);
        diagnostics.put("historyCaptureSupported", false);
    }

    private JSObject buildSnapshot(JSArray queue, JSObject diagnostics, boolean captureEnabled) {
        JSObject snapshot = new JSObject();
        snapshot.put("captureEnabled", captureEnabled);
        snapshot.put("buildMode", "native_capture");
        snapshot.put("queue", queue);
        snapshot.put("summary", buildSummary(queue, diagnostics));
        snapshot.put("diagnostics", diagnostics);
        return snapshot;
    }

    private JSObject buildSummary(JSArray queue, JSObject diagnostics) {
        JSObject summary = new JSObject();
        int pendingCount = 0;
        int parsingCount = 0;
        int parsedCount = 0;
        int unmatchedCount = 0;
        int failedCount = 0;
        String lastCapturedAt = null;
        String lastProcessedAt = null;

        for (int index = 0; index < queue.length(); index += 1) {
            JSONObject rawItem = queue.optJSONObject(index);
            if (rawItem == null) {
                continue;
            }

            String status = rawItem.optString("status", "captured");
            switch (status) {
                case "parsing":
                    parsingCount += 1;
                    break;
                case "parsed":
                    parsedCount += 1;
                    break;
                case "unmatched":
                    unmatchedCount += 1;
                    break;
                case "failed":
                    failedCount += 1;
                    break;
                default:
                    pendingCount += 1;
                    break;
            }

            String capturedAt = rawItem.optString("capturedAt", null);
            if (capturedAt != null && (lastCapturedAt == null || capturedAt.compareTo(lastCapturedAt) > 0)) {
                lastCapturedAt = capturedAt;
            }

            String parsedAt = rawItem.optString("parsedAt", null);
            if (parsedAt != null && !parsedAt.isEmpty()) {
                if (lastProcessedAt == null || parsedAt.compareTo(lastProcessedAt) > 0) {
                    lastProcessedAt = parsedAt;
                }
            }

            String failedAt = rawItem.optString("failedAt", null);
            if (failedAt != null && !failedAt.isEmpty()) {
                if (lastProcessedAt == null || failedAt.compareTo(lastProcessedAt) > 0) {
                    lastProcessedAt = failedAt;
                }
            }
        }

        if (lastCapturedAt == null) {
            lastCapturedAt = diagnostics.optString("lastCapturedAt", null);
        }

        summary.put("pendingCount", pendingCount);
        summary.put("parsingCount", parsingCount);
        summary.put("parsedCount", parsedCount);
        summary.put("unmatchedCount", unmatchedCount);
        summary.put("failedCount", failedCount);
        putNullable(summary, "lastCapturedAt", lastCapturedAt);
        putNullable(summary, "lastProcessedAt", lastProcessedAt);
        return summary;
    }

    private boolean containsHash(JSArray queue, String hash) {
        for (int index = 0; index < queue.length(); index += 1) {
            JSONObject queueItem = queue.optJSONObject(index);
            if (queueItem != null && hash.equals(queueItem.optString("hash"))) {
                return true;
            }
        }

        return false;
    }

    private void incrementCounter(JSObject source, String key) {
        source.put(key, source.optInt(key, 0) + 1);
    }

    private void copyIfPresent(JSObject source, JSObject target, String key) throws JSONException {
        if (source.has(key)) {
            Object value = source.get(key);
            target.put(key, value);
        }
    }

    private JSObject copyObject(JSONObject source) {
        if (source == null) {
            return null;
        }

        try {
            return JSObject.fromJSONObject(source);
        } catch (JSONException error) {
            return null;
        }
    }

    private void putNullable(JSObject target, String key, Object value) {
        target.put(key, value == null ? JSONObject.NULL : value);
    }

    private String compactText(String value) {
        if (value == null) {
            return "";
        }

        return value.trim().replaceAll("\\s+", " ");
    }

    private String buildHash(String senderLabel, String smsBody, String receivedAt) {
        return normalizeSender(senderLabel) + "::" + smsBody.toLowerCase(Locale.ROOT) + "::" + receivedAt;
    }

    private String normalizeSender(String senderLabel) {
        return compactText(senderLabel).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String buildMessageId(long receivedAtMillis, String hash) {
        return "android-" + receivedAtMillis + "-" + Integer.toUnsignedString(hash.hashCode());
    }

    private String buildCaptureId(String messageId, String capturedAt) {
        return "capture-" + messageId + "-" + capturedAt.replaceAll("\\D", "");
    }

    private String formatIsoTimestamp(long timestampMillis) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date(timestampMillis));
    }
}

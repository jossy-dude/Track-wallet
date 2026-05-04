package com.omnisync.mobile.smscapture;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.SmsMessage;
import android.telephony.SubscriptionManager;
import android.provider.Telephony;
import com.getcapacitor.JSObject;

public class SmsCaptureBroadcastReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        SmsCaptureStore store = new SmsCaptureStore(context);
        try {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages == null || messages.length == 0) {
                return;
            }

            String senderLabel = "";
            StringBuilder smsBody = new StringBuilder();
            long receivedAtMillis = 0L;

            for (SmsMessage message : messages) {
                if (message == null) {
                    continue;
                }

                if (senderLabel.isEmpty()) {
                    String candidate = message.getDisplayOriginatingAddress();
                    if (candidate == null || candidate.isEmpty()) {
                        candidate = message.getOriginatingAddress();
                    }
                    senderLabel = candidate == null ? "" : candidate;
                }

                String messageBody = message.getDisplayMessageBody();
                if (messageBody == null || messageBody.isEmpty()) {
                    messageBody = message.getMessageBody();
                }
                if (messageBody != null) {
                    smsBody.append(messageBody);
                }

                if (message.getTimestampMillis() > receivedAtMillis) {
                    receivedAtMillis = message.getTimestampMillis();
                }
            }

            int subscriptionIndex = intent.getIntExtra(SubscriptionManager.EXTRA_SUBSCRIPTION_INDEX, -1);
            int slotIndex = intent.getIntExtra(SubscriptionManager.EXTRA_SLOT_INDEX, -1);
            JSObject item = store.captureSms(
                senderLabel,
                smsBody.toString(),
                receivedAtMillis,
                subscriptionIndex >= 0 ? String.valueOf(subscriptionIndex) : null,
                slotIndex >= 0 ? Integer.valueOf(slotIndex) : null
            );
            if (item != null) {
                SmsCaptureRuntime.notifyCaptured(item);
            }
        } catch (RuntimeException error) {
            store.recordFailure("sms_receiver_error: " + error.getMessage());
        }
    }
}

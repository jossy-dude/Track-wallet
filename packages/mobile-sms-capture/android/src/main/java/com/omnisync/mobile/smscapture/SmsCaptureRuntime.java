package com.omnisync.mobile.smscapture;

import com.getcapacitor.JSObject;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

final class SmsCaptureRuntime {

    interface Listener {
        void onCaptured(JSObject item);
    }

    private static final Set<Listener> LISTENERS = new CopyOnWriteArraySet<>();

    private SmsCaptureRuntime() {}

    static void addListener(Listener listener) {
        LISTENERS.add(listener);
    }

    static void removeListener(Listener listener) {
        LISTENERS.remove(listener);
    }

    static void notifyCaptured(JSObject item) {
        for (Listener listener : LISTENERS) {
            listener.onCaptured(item);
        }
    }
}

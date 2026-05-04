package com.omnisync.mobile.smscapture;

import android.Manifest;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "MobileSmsCapture",
    permissions = {
        @Permission(alias = SmsCapturePlugin.RECEIVE_SMS_PERMISSION, strings = { Manifest.permission.RECEIVE_SMS }),
    }
)
public class SmsCapturePlugin extends Plugin {

    static final String RECEIVE_SMS_PERMISSION = "receiveSms";

    private SmsCaptureStore store;

    private final SmsCaptureRuntime.Listener runtimeListener = item -> {
        JSObject payload = new JSObject();
        payload.put("item", item);
        payload.put("snapshot", store.getSnapshot(resolvePermissionState()));
        notifyListeners("smsCaptured", payload, true);
    };

    @Override
    public void load() {
        store = new SmsCaptureStore(getContext());
        SmsCaptureRuntime.addListener(runtimeListener);
    }

    @Override
    protected void handleOnDestroy() {
        SmsCaptureRuntime.removeListener(runtimeListener);
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        call.resolve(store.getSnapshot(resolvePermissionState()));
    }

    @PluginMethod
    public void clearRuntimeState(PluginCall call) {
        call.resolve(store.clearRuntimeState(resolvePermissionState()));
    }

    @PluginMethod
    public void setCaptureEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", null);
        if (enabled == null) {
            call.reject("enabled is required");
            return;
        }

        call.resolve(store.setCaptureEnabled(enabled, resolvePermissionState()));
    }

    @PluginMethod
    public void acknowledgeMessages(PluginCall call) {
        JSArray captureIds = call.getArray("captureIds");
        if (captureIds == null) {
            call.reject("captureIds is required");
            return;
        }

        call.resolve(store.acknowledgeMessages(captureIds, resolvePermissionState()));
    }

    private String resolvePermissionState() {
        PermissionState permissionState = getPermissionState(RECEIVE_SMS_PERMISSION);
        if (permissionState == null) {
            return "unknown";
        }

        switch (permissionState) {
            case GRANTED:
                return "granted";
            case DENIED:
                return "denied";
            case PROMPT:
            case PROMPT_WITH_RATIONALE:
                return "prompt";
            default:
                return "unknown";
        }
    }
}

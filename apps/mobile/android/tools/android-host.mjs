import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolFilePath = fileURLToPath(import.meta.url);
const toolDir = path.dirname(toolFilePath);
const androidDir = path.dirname(toolDir);
const appDir = path.dirname(androidDir);
const repoRoot = path.resolve(appDir, "..", "..");

const pluginId = "@omni-sync/mobile-sms-capture";
const pluginGradleName = "omni-sync-mobile-sms-capture";
const pluginClasspath = "com.omnisync.mobile.smscapture.SmsCapturePlugin";
const pluginAndroidDir = path.resolve(repoRoot, "packages", "mobile-sms-capture", "android");

const capacitorCliPath = path.resolve(repoRoot, "node_modules", "@capacitor", "cli", "bin", "capacitor");
const viteCliPath = path.resolve(repoRoot, "node_modules", "vite", "bin", "vite.js");
const gradleWrapperFilePath = path.resolve(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const gradleWrapperCommand = process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew";
const androidAppId = "com.omnisync.mobile";
const androidLaunchActivity = `${androidAppId}/.MainActivity`;

const settingsGradlePath = path.resolve(androidDir, "capacitor.settings.gradle");
const capacitorBuildGradlePath = path.resolve(androidDir, "app", "capacitor.build.gradle");
const capacitorPluginsJsonPath = path.resolve(
  androidDir,
  "app",
  "src",
  "main",
  "assets",
  "capacitor.plugins.json",
);

async function main() {
  const action = process.argv[2] ?? "sync";

  switch (action) {
    case "doctor":
      printDoctorReport();
      return;
    case "targets":
      printTargetDiscoveryReport();
      return;
    case "sync":
      await syncAndroidHost();
      return;
    case "assembleDebug":
    case "assembleRelease":
      await syncAndroidHost();
      assertPathExists(gradleWrapperFilePath, `Gradle wrapper not found: ${gradleWrapperFilePath}`);
      runCommand(gradleWrapperCommand, [action], androidDir);
      return;
    case "installDebug": {
      const targetInfo = requireRunnableTarget();
      await syncAndroidHost();
      assertPathExists(gradleWrapperFilePath, `Gradle wrapper not found: ${gradleWrapperFilePath}`);
      runCommand(gradleWrapperCommand, [action], androidDir);
      console.log(`Installed debug build after target preflight passed on ${targetInfo.selectedTarget.serial}.`);
      return;
    }
    case "smokeDebug": {
      const targetInfo = requireRunnableTarget();
      await syncAndroidHost();
      assertPathExists(gradleWrapperFilePath, `Gradle wrapper not found: ${gradleWrapperFilePath}`);
      runCommand(gradleWrapperCommand, ["installDebug"], androidDir);
      launchDebugApp(targetInfo.selectedTarget.serial);
      return;
    }
    default:
      console.error(
        `Unsupported Android host action "${action}". Expected one of: doctor, targets, sync, assembleDebug, assembleRelease, installDebug, smokeDebug.`,
      );
      process.exit(1);
  }
}

async function syncAndroidHost() {
  assertPathExists(pluginAndroidDir, `Android plugin folder not found: ${pluginAndroidDir}`);
  runNodeCli(viteCliPath, ["build"], appDir);
  runNodeCli(capacitorCliPath, ["sync", "android"], appDir);
  await ensureSmsPluginRegistration();
}

async function ensureSmsPluginRegistration() {
  const pluginSettingsBlock = [
    `include ':${pluginGradleName}'`,
    `project(':${pluginGradleName}').projectDir = new File('${toUnixPath(path.relative(androidDir, pluginAndroidDir))}')`,
    "",
  ].join("\n");

  const capacitorSettings = await readFile(settingsGradlePath, "utf8");
  if (!capacitorSettings.includes(`project(':${pluginGradleName}')`)) {
    await writeFile(settingsGradlePath, `${capacitorSettings.trimEnd()}\n${pluginSettingsBlock}`, "utf8");
  }

  const pluginDependencyLine = `    implementation project(':${pluginGradleName}')`;
  const capacitorBuildGradle = await readFile(capacitorBuildGradlePath, "utf8");
  if (!capacitorBuildGradle.includes(pluginDependencyLine)) {
    const patchedCapacitorBuildGradle = capacitorBuildGradle.replace(
      "dependencies {\n",
      `dependencies {\n${pluginDependencyLine}\n`,
    );

    if (patchedCapacitorBuildGradle === capacitorBuildGradle) {
      throw new Error(`Unable to inject ${pluginGradleName} into ${capacitorBuildGradlePath}`);
    }

    await writeFile(capacitorBuildGradlePath, patchedCapacitorBuildGradle, "utf8");
  }

  await mkdir(path.dirname(capacitorPluginsJsonPath), { recursive: true });
  const rawPluginList = existsSync(capacitorPluginsJsonPath)
    ? await readFile(capacitorPluginsJsonPath, "utf8")
    : "[]";
  const pluginEntries = JSON.parse(rawPluginList);
  const hasSmsPluginEntry = pluginEntries.some(
    (entry) => entry?.pkg === pluginId && entry?.classpath === pluginClasspath,
  );

  if (!hasSmsPluginEntry) {
    pluginEntries.push({
      pkg: pluginId,
      classpath: pluginClasspath,
    });
    pluginEntries.sort((left, right) => left.pkg.localeCompare(right.pkg));
    await writeFile(capacitorPluginsJsonPath, `${JSON.stringify(pluginEntries, null, "\t")}\n`, "utf8");
  }
}

function runNodeCli(scriptPath, args, cwd) {
  assertPathExists(scriptPath, `Required CLI script not found: ${scriptPath}`);
  runCommand(process.execPath, [scriptPath, ...args], cwd);
}

function runCommand(command, args, cwd) {
  const result = executeCommand(command, args, cwd, { captureOutput: false });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function captureCommand(command, args, cwd) {
  const result = executeCommand(command, args, cwd, { captureOutput: true });

  return {
    error: result.error ?? null,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function executeCommand(command, args, cwd, { captureOutput }) {
  const commandEnv = buildCommandEnv();
  const isWindowsBatchFile = process.platform === "win32" && command.toLowerCase().endsWith(".bat");
  const effectiveCommand = isWindowsBatchFile
    ? process.env.ComSpec ?? "cmd.exe"
    : command;
  const effectiveArgs = isWindowsBatchFile ? ["/d", "/s", "/c", command, ...args] : args;
  const spawnOptions = captureOutput
    ? { cwd, env: commandEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    : { cwd, env: commandEnv, stdio: "inherit" };

  return spawnSync(effectiveCommand, effectiveArgs, spawnOptions);
}

function assertPathExists(targetPath, errorMessage) {
  if (!existsSync(targetPath)) {
    throw new Error(errorMessage);
  }
}

function buildCommandEnv() {
  const commandEnv = { ...process.env };
  const defaultAndroidSdkRoot = path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");

  if (!commandEnv.ANDROID_SDK_ROOT && existsSync(defaultAndroidSdkRoot)) {
    commandEnv.ANDROID_SDK_ROOT = defaultAndroidSdkRoot;
  }

  if (!commandEnv.ANDROID_HOME && commandEnv.ANDROID_SDK_ROOT) {
    commandEnv.ANDROID_HOME = commandEnv.ANDROID_SDK_ROOT;
  }

  return commandEnv;
}

function printDoctorReport() {
  const toolPaths = resolveAndroidToolPaths();
  const targetsReport = readConnectedTargets(toolPaths);
  const avdReport = readConfiguredAvds(toolPaths);
  const installableTargets = targetsReport.targets.filter((target) => target.state === "device");
  const emulatorLaunchReady = Boolean(toolPaths.emulatorPath) && avdReport.avdNames.length > 0;

  console.log("Android doctor");
  console.log(`- sdkRoot: ${formatPathStatus(toolPaths.sdkRoot)}`);
  console.log(`- adb: ${formatPathStatus(toolPaths.adbPath)}`);
  console.log(`- avdmanager: ${formatPathStatus(toolPaths.avdManagerPath)}`);
  console.log(`- emulator: ${formatPathStatus(toolPaths.emulatorPath)}`);
  console.log(`- connectedTargets: ${formatTargetSummary(targetsReport)}`);
  console.log(`- configuredAvds: ${formatAvdSummary(avdReport)}`);
  console.log(`- installReady: ${installableTargets.length > 0 ? "yes" : "no"}`);
  console.log(`- smokeReady: ${installableTargets.length > 0 ? "yes" : "no"}`);
  console.log(`- emulatorLaunchReady: ${emulatorLaunchReady ? "yes" : "no"}`);

  if (targetsReport.error) {
    console.log(`- targetQueryNote: ${targetsReport.error}`);
  }

  if (avdReport.error) {
    console.log(`- avdQueryNote: ${avdReport.error}`);
  }

  if (installableTargets.length === 0) {
    console.log(
      '- nextStep: attach a USB-debuggable device or boot an emulator, then rerun "npm run android:install:debug" or "npm run android:smoke:debug".',
    );
  }
}

function printTargetDiscoveryReport() {
  const toolPaths = resolveAndroidToolPaths();
  const targetsReport = readConnectedTargets(toolPaths);
  const avdReport = readConfiguredAvds(toolPaths);

  console.log("Android target discovery");
  console.log("Connected targets");

  if (targetsReport.targets.length === 0) {
    console.log("- none");
  } else {
    for (const target of targetsReport.targets) {
      const detailSuffix = target.details ? ` ${target.details}` : "";
      console.log(`- ${target.serial} [${target.state}]${detailSuffix}`);
    }
  }

  if (targetsReport.error) {
    console.log(`- query note: ${targetsReport.error}`);
  }

  console.log("Configured AVDs");

  if (avdReport.avdNames.length === 0) {
    console.log("- none");
  } else {
    for (const avdName of avdReport.avdNames) {
      console.log(`- ${avdName}`);
    }
  }

  if (avdReport.error) {
    console.log(`- query note: ${avdReport.error}`);
  }
}

function requireRunnableTarget() {
  const toolPaths = resolveAndroidToolPaths();

  if (!toolPaths.adbPath) {
    console.error("No adb executable was discovered under the Android SDK. Run \"npm run android:doctor\" for details.");
    process.exit(1);
  }

  const targetsReport = readConnectedTargets(toolPaths);
  const installableTargets = targetsReport.targets.filter((target) => target.state === "device");

  if (installableTargets.length === 0) {
    console.error("No connected Android device or booted emulator is ready for install or smoke.");

    if (targetsReport.error) {
      console.error(targetsReport.error);
    }

    console.error("Use \"npm run android:targets\" to inspect attached devices and configured AVDs.");
    console.error("Attach a USB-debuggable device or start an emulator, then rerun this command.");
    process.exit(1);
  }

  const requestedSerial = process.env.ANDROID_SERIAL;
  const selectedTarget = requestedSerial
    ? installableTargets.find((target) => target.serial === requestedSerial)
    : installableTargets[0];

  if (!selectedTarget) {
    console.error(
      `ANDROID_SERIAL=${requestedSerial} was set, but that serial is not currently connected. Run "npm run android:targets" and retry with a live target.`,
    );
    process.exit(1);
  }

  console.log(`Android target ready: ${selectedTarget.serial} [${selectedTarget.state}]`);

  return {
    toolPaths,
    selectedTarget,
  };
}

function launchDebugApp(targetSerial) {
  const toolPaths = resolveAndroidToolPaths();
  const launchResult = captureCommand(
    toolPaths.adbPath,
    ["-s", targetSerial, "shell", "am", "start", "-W", "-n", androidLaunchActivity],
    repoRoot,
  );
  const combinedOutput = [launchResult.stdout.trim(), launchResult.stderr.trim()].filter(Boolean).join("\n");

  if (launchResult.error || launchResult.status !== 0 || combinedOutput.includes("Error:")) {
    console.error(`Debug app launch failed for target ${targetSerial}.`);

    if (launchResult.error) {
      console.error(launchResult.error.message);
    }

    if (combinedOutput) {
      console.error(combinedOutput);
    }

    process.exit(launchResult.status || 1);
  }

  console.log(`Launched ${androidLaunchActivity} on ${targetSerial}.`);

  if (combinedOutput) {
    console.log(combinedOutput);
  }
}

function resolveAndroidToolPaths() {
  const sdkRootCandidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
  ].filter(Boolean);
  const sdkRoot = sdkRootCandidates.find((candidatePath) => existsSync(candidatePath)) ?? null;

  return {
    sdkRoot,
    adbPath: sdkRoot
      ? findFirstExistingPath([path.join(sdkRoot, "platform-tools", executableName("adb"))])
      : null,
    avdManagerPath: sdkRoot ? findFirstExistingPath(buildAvdManagerCandidates(sdkRoot)) : null,
    emulatorPath: sdkRoot
      ? findFirstExistingPath([path.join(sdkRoot, "emulator", executableName("emulator"))])
      : null,
  };
}

function readConnectedTargets(toolPaths) {
  if (!toolPaths.adbPath) {
    return {
      targets: [],
      error: "adb was not found under the resolved Android SDK root.",
    };
  }

  const adbResult = captureCommand(toolPaths.adbPath, ["devices", "-l"], repoRoot);

  if (adbResult.error) {
    return {
      targets: [],
      error: `adb devices -l failed to start. ${adbResult.error.message}`,
    };
  }

  if (adbResult.status !== 0) {
    return {
      targets: [],
      error: buildCommandFailureMessage("adb devices -l", adbResult),
    };
  }

  return {
    targets: adbResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("List of devices attached") && !line.startsWith("* daemon"))
      .map(parseAdbTargetLine)
      .filter(Boolean),
    error: "",
  };
}

function readConfiguredAvds(toolPaths) {
  if (!toolPaths.avdManagerPath) {
    return {
      avdNames: [],
      error: "avdmanager was not found under the resolved Android SDK root.",
    };
  }

  const avdResult = captureCommand(toolPaths.avdManagerPath, ["list", "avd"], repoRoot);
  const combinedOutput = `${avdResult.stdout}\n${avdResult.stderr}`;

  if (avdResult.error) {
    return {
      avdNames: [],
      error: `avdmanager list avd failed to start. ${avdResult.error.message}`,
    };
  }

  if (avdResult.status !== 0) {
    return {
      avdNames: [],
      error: buildCommandFailureMessage("avdmanager list avd", avdResult),
    };
  }

  return {
    avdNames: combinedOutput
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*Name:\s*(.+)$/)?.[1]?.trim())
      .filter(Boolean),
    error: "",
  };
}

function parseAdbTargetLine(line) {
  const [serial, state, ...details] = line.split(/\s+/);

  if (!serial || !state) {
    return null;
  }

  return {
    serial,
    state,
    details: details.join(" "),
  };
}

function buildAvdManagerCandidates(sdkRoot) {
  const cmdlineToolsDir = path.join(sdkRoot, "cmdline-tools");
  const candidates = [path.join(cmdlineToolsDir, "latest", "bin", executableName("avdmanager"))];

  if (!existsSync(cmdlineToolsDir)) {
    return candidates;
  }

  for (const entry of readdirSync(cmdlineToolsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "latest") {
      continue;
    }

    candidates.push(path.join(cmdlineToolsDir, entry.name, "bin", executableName("avdmanager")));
  }

  return candidates;
}

function findFirstExistingPath(candidatePaths) {
  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? null;
}

function executableName(baseName) {
  if (process.platform !== "win32") {
    return baseName;
  }

  return baseName === "avdmanager" ? "avdmanager.bat" : `${baseName}.exe`;
}

function buildCommandFailureMessage(commandLabel, commandResult) {
  const output = [commandResult.stdout.trim(), commandResult.stderr.trim()].filter(Boolean).join("\n");
  return output
    ? `${commandLabel} exited with code ${commandResult.status}. Output: ${output}`
    : `${commandLabel} exited with code ${commandResult.status}.`;
}

function formatPathStatus(targetPath) {
  return targetPath ?? "not found";
}

function formatTargetSummary(targetsReport) {
  if (targetsReport.targets.length === 0) {
    return "none";
  }

  return targetsReport.targets.map((target) => `${target.serial} [${target.state}]`).join(", ");
}

function formatAvdSummary(avdReport) {
  if (avdReport.avdNames.length === 0) {
    return "none";
  }

  return avdReport.avdNames.join(", ");
}

function toUnixPath(targetPath) {
  return targetPath.replace(/\\/g, "/");
}

await main();

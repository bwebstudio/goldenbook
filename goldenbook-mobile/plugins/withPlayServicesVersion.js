const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Force a specific Google Play Services version across all transitive
 * Android deps that read `rootProject.ext.playServicesVersion` via
 * `safeExtGet` — most notably react-native-maps, which defaults to
 * play-services-maps:18.2.0 (NOT 16 KB page-size aligned).
 *
 * play-services-maps:19.0.0 was the first release with `.so` libraries
 * aligned to 16 KB, which Google Play Console requires for new uploads
 * targeting Android 15+. Pinning here means we don't need to bump
 * react-native-maps itself or churn package.json.
 *
 * The line is injected inside `buildscript { ext { ... } }` of the
 * project-level android/build.gradle. Idempotent — re-running prebuild
 * is safe.
 */
const PLAY_SERVICES_VERSION = "19.0.0";

function withPlayServicesVersion(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    if (contents.includes("playServicesVersion")) {
      return cfg;
    }

    const extMatch = contents.match(/ext\s*\{/);
    if (!extMatch) {
      return cfg;
    }

    const insertPos = extMatch.index + extMatch[0].length;
    const line = `\n        playServicesVersion = "${PLAY_SERVICES_VERSION}" // 16 KB-aligned`;

    cfg.modResults.contents =
      contents.slice(0, insertPos) + line + contents.slice(insertPos);

    return cfg;
  });
}

module.exports = withPlayServicesVersion;

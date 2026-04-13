const {
  withGradleProperties,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const NDK_VERSION = "27.2.12479018"; // NDK r27b

/**
 * Expo config plugin for 16 KB page-size support on Android.
 *
 * Google Play requires apps targeting API 35 to support 16 KB page sizes.
 * Per https://developer.android.com/guide/practices/page-sizes this plugin:
 *
 *   1. Overrides ndkVersion to r27b in gradle.properties AND root build.gradle
 *   2. Passes -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON to CMake (required by
 *      NDK 27 — NDK 28+ does it automatically but isn't available on EAS yet)
 *   3. Sets jniLibs.useLegacyPackaging = false so the AAB stores .so files
 *      uncompressed with proper zip alignment
 */
function withAndroid16KBPages(config) {
  // ── 1. gradle.properties — set ndkVersion ─────────────────────────
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;
    const idx = props.findIndex(
      (p) => p.type === "property" && p.key === "ndkVersion"
    );
    if (idx !== -1) props.splice(idx, 1);
    props.push({ type: "property", key: "ndkVersion", value: NDK_VERSION });
    return config;
  });

  // ── 2. Root build.gradle — make ndkVersion read from gradle.properties
  config = withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /ndkVersion\s*=\s*"[^"]*"/,
      `ndkVersion = findProperty('ndkVersion') ?: "${NDK_VERSION}"`
    );
    return config;
  });

  // ── 3. app/build.gradle — CMake flag + jniLibs packaging ─────────
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes("ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES")) {
      return config;
    }

    const patch = `
    // ── 16 KB page-size support (injected by withAndroid16KBPages) ──
    packagingOptions {
        jniLibs {
            useLegacyPackaging = false
        }
    }
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
            }
        }
    }`;

    const match = contents.match(/android\s*\{/);
    if (match) {
      const insertPos = match.index + match[0].length;
      config.modResults.contents =
        contents.slice(0, insertPos) + patch + contents.slice(insertPos);
    }

    return config;
  });

  return config;
}

module.exports = withAndroid16KBPages;

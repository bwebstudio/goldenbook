const {
  withAppBuildGradle,
} = require("expo/config-plugins");

/**
 * Expo config plugin for 16 KB page-size support on Android.
 *
 * With Expo SDK 53 / React Native 0.79 (NDK 27), the prebuilt .so files
 * already support 16 KB page sizes. This plugin adds the CMake flag
 * -DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON required by NDK 27 for any
 * native code compiled by the project (reanimated, rnscreens, etc.)
 * and sets jniLibs.useLegacyPackaging = false for proper zip alignment.
 *
 * See: https://developer.android.com/guide/practices/page-sizes
 */
function withAndroid16KBPages(config) {
  return withAppBuildGradle(config, (config) => {
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
}

module.exports = withAndroid16KBPages;

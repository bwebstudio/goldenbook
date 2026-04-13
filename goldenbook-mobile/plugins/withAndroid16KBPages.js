const { withGradleProperties } = require("expo/config-plugins");

/**
 * Expo config plugin that overrides ndkVersion to 27.2.12479018 (NDK r27b).
 *
 * React Native 0.76 ships with NDK 26 which produces 4 KB-aligned native
 * libraries.  Google Play now requires 16 KB page-size support for apps
 * targeting API 35.  NDK 27+ links arm64 shared libraries with
 * -z max-page-size=65536, making them compatible with both 4 KB and 16 KB
 * page sizes.
 *
 * The React Native Gradle build reads `ndkVersion` from gradle.properties
 * and uses it as an override when present.
 */
function withAndroid16KBPages(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    // Remove any existing ndkVersion entry to avoid duplicates
    const idx = props.findIndex(
      (p) => p.type === "property" && p.key === "ndkVersion"
    );
    if (idx !== -1) props.splice(idx, 1);

    props.push({
      type: "property",
      key: "ndkVersion",
      value: "27.2.12479018",
    });

    return config;
  });
}

module.exports = withAndroid16KBPages;

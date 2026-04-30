const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Force 16 KB-aligned versions of the two transitive image-decoding native
 * libraries that ship pre-compiled .so files in their AARs.
 *
 * Diagnosed from inspecting the AAB rejected by Google Play (versionCode 78):
 *   FAIL  arm64-v8a/libavif_android.so          align=0x1000 (4 KB)
 *   FAIL  arm64-v8a/libanimation-decoder-gif.so align=0x1000 (4 KB)
 *
 * Source AARs (from gradle cache):
 *   libavif_android.so               ← org.aomedia.avif.android:avif:1.0.1.262e11d
 *   libanimation-decoder-gif.so      ← com.github.penfeizhou.android.animation:gif:3.0.2
 *
 * Both pulled transitively by expo-image@2.1.7 via:
 *   com.github.bumptech.glide:avif-integration:4.16.0   → avif:1.0.1.262e11d
 *   com.github.penfeizhou.android.animation:glide-plugin:3.0.3 → gif:3.0.2
 *
 * Verified 16 KB-aligned replacements (downloaded + llvm-readelf checked):
 *   org.aomedia.avif.android:avif:1.1.1.14d8e3c4         max-align=0x4000 ✓
 *   com.github.penfeizhou.android.animation:gif:3.0.5    max-align=0x4000 ✓
 *
 * Both are minor-patch bumps within the same major API surface, so forcing
 * via Gradle resolutionStrategy is API-safe vs. their parent integrations
 * (avif-integration:4.16.0 and glide-plugin:3.0.3).
 *
 * play-services-maps is NOT bundled in the AAB (Google Play delivers it on
 * device at install/runtime), so it cannot cause this rejection — that's
 * why the prior playServicesVersion override fixed nothing.
 */
const FORCED = [
  "com.github.penfeizhou.android.animation:gif:3.0.5",
  "org.aomedia.avif.android:avif:1.1.1.14d8e3c4",
];

const MARKER = "// 16KB_FORCED_DEPS";

function withImageDeps16KB(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    if (contents.includes(MARKER)) {
      return cfg;
    }

    const forces = FORCED.map((coord) => `        force "${coord}"`).join("\n");
    const patch = `

${MARKER}
configurations.all {
    resolutionStrategy {
${forces}
    }
}
`;

    cfg.modResults.contents = contents + patch;
    return cfg;
  });
}

module.exports = withImageDeps16KB;

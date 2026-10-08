const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

/**
 * Turn off `consteval` in fmt so Xcode 26.4+ can build it.
 *
 * EAS build of 1.2.0 failed on the `latest` image (Xcode 26.4, Apple clang
 * 21) inside fmt 11.0.2, the version React Native 0.79 pins:
 *
 *   call to consteval function 'fmt::basic_format_string<char,
 *   fmt::basic_string_view<char> &, const char (&)[3]>::basic_format_string
 *   <FMT_COMPILE_STRING, 0>' is not a constant expression
 *
 * fmt's base.h enables the consteval format-string constructor for Apple
 * clang >= 14, and clang 21 now rejects fmt's own FMT_STRING calls in
 * format-inl.h. Upstream: https://github.com/fmtlib/fmt/issues/4740
 *
 * A -DFMT_USE_CONSTEVAL=0 flag does not help: base.h redefines the macro
 * unconditionally. So after pods are installed we rewrite the two lines in
 * base.h that set it to 1. Format strings are then checked at runtime
 * instead of at compile time; behaviour is otherwise identical, and every
 * pod that includes fmt sees the same header.
 *
 * Remove once the app is on a React Native version that ships a fixed fmt.
 */
const MARKER = "# FMT_NO_CONSTEVAL";

const SNIPPET = `
    ${MARKER}: fmt 11.0.2 consteval breaks on Xcode 26.4+ (see plugins/withFmtNoConsteval.js)
    fmt_base = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      source = File.read(fmt_base)
      patched = source.gsub(/^#  define FMT_USE_CONSTEVAL 1\\b/, '#  define FMT_USE_CONSTEVAL 0')
      if patched != source
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
        Pod::UI.puts '[withFmtNoConsteval] fmt consteval disabled in base.h'
      end
    end`;

function insertAfterReactNativePostInstall(podfile) {
  const start = podfile.indexOf("react_native_post_install(");
  if (start === -1) {
    throw new Error("[withFmtNoConsteval] react_native_post_install( not found in Podfile");
  }
  // Walk to the parenthesis that closes the call.
  let depth = 0;
  for (let i = podfile.indexOf("(", start); i < podfile.length; i++) {
    if (podfile[i] === "(") depth++;
    if (podfile[i] === ")") depth--;
    if (depth === 0) {
      return podfile.slice(0, i + 1) + "\n" + SNIPPET + podfile.slice(i + 1);
    }
  }
  throw new Error("[withFmtNoConsteval] unbalanced react_native_post_install call");
}

function withFmtNoConsteval(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      const podfile = fs.readFileSync(podfilePath, "utf8");
      if (!podfile.includes(MARKER)) {
        fs.writeFileSync(podfilePath, insertAfterReactNativePostInstall(podfile));
      }
      return cfg;
    },
  ]);
}

module.exports = withFmtNoConsteval;

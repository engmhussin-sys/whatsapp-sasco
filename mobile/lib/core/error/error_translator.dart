import 'package:easy_localization/easy_localization.dart';
import 'backend_error_keys.dart';

/// Translates a raw backend error message (always English — see the
/// backend's HttpExceptionFilter, which never localizes) into the
/// person's CURRENT app language, using the same 'errors.*' namespace
/// already merged into every assets/translations/*.json file.
///
/// WHY a client-side dictionary instead of backend-side i18n: the
/// backend throws ~124 distinct hardcoded English messages across 30+
/// service files. Changing every one of those call sites to emit a
/// stable error CODE instead of a message would touch a huge, already-
/// tested surface for comparatively little gain — this dictionary
/// achieves the same user-facing result (a message in their own
/// language) by translating at the one place ALL of those messages
/// already funnel through on the client (DioClient._mapError).
///
/// Uses easy_localization's own `.tr()` — which already resolves the
/// CURRENT locale globally, no BuildContext needed — so this works
/// identically whether called from a Bloc, a Cubit, or a widget.
class ErrorTranslator {
  ErrorTranslator._();

  /// [rawMessage] is whatever ServerException.message currently holds —
  /// almost always the backend's raw English text, but this also
  /// tolerates already-localized strings (the small number of onboarding
  /// messages already written in Arabic server-side) by mapping them to
  /// themselves in the dictionary, so calling this is always safe
  /// regardless of the message's origin.
  static String translate(String rawMessage) {
    // BUG FIX (found via real screenshot QA, same root cause already
    // fixed on the web dashboard): ModuleGuard's error message is
    // DYNAMIC — it embeds the module code ("This company does not have
    // the ASSET_MANAGEMENT module active") — so the static map below can
    // never match it exactly. Checked first, via regex, before the map.
    final moduleGuardMatch = RegExp(r'^This company does not have the (\w+) module active$').firstMatch(rawMessage);
    if (moduleGuardMatch != null) {
      final moduleCode = moduleGuardMatch.group(1)!;
      final moduleNameKey = 'modules.$moduleCode';
      final moduleNameAr = moduleNameKey.tr();
      // easy_localization returns the key itself when unmapped — fall
      // back to the raw code rather than showing a literal dotted key.
      final moduleName = moduleNameAr == moduleNameKey ? moduleCode : moduleNameAr;
      return 'errors.module_not_active'.tr(namedArgs: {'module': moduleName});
    }

    final key = kBackendErrorKeys[rawMessage];
    if (key == null) {
      // Unmapped message (a newly-added backend exception this
      // dictionary hasn't caught up with yet, or a raw network-layer
      // string like a DioException's own .message). Showing the raw
      // text is still more useful to the person than a generic
      // "something went wrong" — it just won't be localized.
      return rawMessage;
    }
    try {
      return key.tr();
    } catch (_) {
      // Defensive: this is the first call site in the codebase that
      // invokes .tr() from OUTSIDE a widget's build context (every
      // other usage is inline in a widget tree, already guaranteed to
      // run after EasyLocalization has initialized). If .tr() were
      // ever called before that (a genuinely untested edge case here),
      // falling back to the raw English message is far better than
      // crashing error display itself.
      return rawMessage;
    }
  }
}

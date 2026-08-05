import '../network/dio_client.dart';
import '../storage/secure_storage_service.dart';

class SectorPpeItem {
  final String labelAr;
  final String icon; // emoji, matches backend's sector-content.data.ts exactly
  const SectorPpeItem({required this.labelAr, required this.icon});
}

class SectorContent {
  final String code;
  final String nameAr;
  final List<SectorPpeItem> ppeItems;
  final String dailySafetyAlertAr;

  const SectorContent({
    required this.code,
    required this.nameAr,
    required this.ppeItems,
    required this.dailySafetyAlertAr,
  });

  factory SectorContent.fromJson(Map<String, dynamic> json) {
    return SectorContent(
      code: json['code'] as String,
      nameAr: json['nameAr'] as String,
      ppeItems: (json['ppeItems'] as List)
          .map((e) => SectorPpeItem(labelAr: e['labelAr'] as String, icon: e['icon'] as String))
          .toList(),
      dailySafetyAlertAr: json['dailySafetyAlertAr'] as String,
    );
  }
}

/// V3 rebrand — the four-sector content system (see
/// backend/src/modules/companies/sector-content.data.ts, the single
/// source of truth this mirrors). A lightweight standalone service
/// (not the full Clean Architecture datasource/repository/usecase
/// chain used elsewhere) is a deliberate, proportionate choice for a
/// single read-only, cacheable lookup — not a shortcut applied broadly.
///
/// Honest scope note: PPE labels and the safety alert come back in
/// Arabic ONLY from the backend today (see the backend file's own
/// comment) — full 7-language sector content is follow-up work, same
/// as how error-translations.ts documents its own EN-pass-through gap
/// for non-Arabic locales elsewhere in this app.
class SectorContentService {
  final DioClient dioClient;
  final SecureStorageService secureStorage;

  SectorContentService({required this.dioClient, required this.secureStorage});

  SectorContent? _cached;

  Future<SectorContent> getMySectorContent({bool forceRefresh = false}) async {
    if (_cached != null && !forceRefresh) return _cached!;

    final user = await secureStorage.getUser();
    final companyId = user?['companyId'] as String?;
    if (companyId == null) {
      throw StateError('No companyId in stored session — cannot fetch sector content');
    }

    final json = await dioClient.get<Map<String, dynamic>>('/companies/$companyId/sector-content');
    _cached = SectorContent.fromJson(json);
    return _cached!;
  }
}

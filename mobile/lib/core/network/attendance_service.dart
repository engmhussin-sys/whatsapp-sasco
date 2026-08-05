import '../network/dio_client.dart';
import '../storage/secure_storage_service.dart';

class AttendanceStatus {
  final bool checkedIn;
  final String? recordId;
  const AttendanceStatus({required this.checkedIn, this.recordId});

  factory AttendanceStatus.fromJson(Map<String, dynamic> json) {
    final record = json['record'] as Map<String, dynamic>?;
    return AttendanceStatus(checkedIn: json['checkedIn'] as bool, recordId: record?['id'] as String?);
  }
}

/// Sprint 11's backend (GPS-based check-in/check-out — see
/// backend/src/modules/attendance) exposed here for mobile. Lightweight
/// standalone service — same proportionate pattern as
/// SectorContentService — for a small, focused, single-purpose feature
/// rather than the full datasource/repository/usecase chain.
class AttendanceService {
  final DioClient dioClient;
  final SecureStorageService secureStorage;

  AttendanceService({required this.dioClient, required this.secureStorage});

  Future<String?> _companyId() async {
    final user = await secureStorage.getUser();
    return user?['companyId'] as String?;
  }

  Future<AttendanceStatus> getMyStatus() async {
    final companyId = await _companyId();
    final json = await dioClient.get<Map<String, dynamic>>('/companies/$companyId/attendance/me');
    return AttendanceStatus.fromJson(json);
  }

  Future<void> checkIn({double? latitude, double? longitude}) async {
    final companyId = await _companyId();
    await dioClient.post('/companies/$companyId/attendance/check-in', data: {
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    });
  }

  Future<void> checkOut({double? latitude, double? longitude}) async {
    final companyId = await _companyId();
    await dioClient.post('/companies/$companyId/attendance/check-out', data: {
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    });
  }
}

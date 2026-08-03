/// Central place for backend endpoint paths. Mirrors the NestJS controllers
/// exactly (see backend/src/modules/**/*.controller.ts) — every path here
/// corresponds 1:1 to a real, implemented endpoint. No mock endpoints.
class ApiConstants {
  ApiConstants._();

  // Configured via --dart-define at build time, falling back to local dev.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000/api/v1',
  );

  static const String wsUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  // Auth
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';

  // Company-scoped (companyId is interpolated at call time)
  static String companyDashboard(String companyId) => '/companies/$companyId/dashboard';
  static String conversations(String companyId) => '/companies/$companyId/conversations';
  static String messages(String companyId, String conversationId) =>
      '/companies/$companyId/conversations/$conversationId/messages';
  static String sendTextMessage(String companyId, String conversationId) =>
      '${messages(companyId, conversationId)}/text';
  static String sendVoiceMessage(String companyId, String conversationId) =>
      '${messages(companyId, conversationId)}/voice';
  static String markRead(String companyId, String conversationId) =>
      '${messages(companyId, conversationId)}/read';
  static String retranslateConversation(String companyId, String conversationId) =>
      '${messages(companyId, conversationId)}/retranslate';
  static String messageAttachments(String companyId, String conversationId, String messageId) =>
      '${messages(companyId, conversationId)}/$messageId/attachments';
  static String messageById(String companyId, String conversationId, String messageId) =>
      '${messages(companyId, conversationId)}/$messageId';
  static String messageReactions(String companyId, String conversationId, String messageId) =>
      '${messages(companyId, conversationId)}/$messageId/reactions';

  static String updateUser(String companyId, String userId) => '/companies/$companyId/users/$userId';

  static String hazards(String companyId) => '/companies/$companyId/hazards';
  static String hazardPhoto(String companyId) => '/companies/$companyId/hazards/photo';
  static String sos(String companyId) => '/companies/$companyId/sos';

  static String tasks(String companyId) => '/companies/$companyId/tasks';
  static String taskById(String companyId, String taskId) => '/companies/$companyId/tasks/$taskId';
  static String taskResponses(String companyId, String taskId) => '${taskById(companyId, taskId)}/responses';
  static String taskResponseAttachments(String companyId, String responseId) =>
      '/companies/$companyId/tasks/responses/$responseId/attachments';

  static String approvals(String companyId) => '/companies/$companyId/approvals';
  static String approvalById(String companyId, String approvalId) => '/companies/$companyId/approvals/$approvalId';
  static String approvalActions(String companyId, String approvalId) =>
      '${approvalById(companyId, approvalId)}/actions';

  static String shifts(String companyId) => '/companies/$companyId/shifts';
  static String shiftLogsMine(String companyId) => '/companies/$companyId/shift-logs/mine';
  static String openShiftLog(String companyId) => '/companies/$companyId/shift-logs/open';
  static String closeShiftLog(String companyId, String shiftLogId) =>
      '/companies/$companyId/shift-logs/$shiftLogId/close';

  static String fuelRequests(String companyId) => '/companies/$companyId/fuel-requests';
  static String fuelRequestById(String companyId, String id) => '/companies/$companyId/fuel-requests/$id';
  static String fuelRequestActions(String companyId, String id) => '${fuelRequestById(companyId, id)}/actions';

  static String stations(String companyId) => '/companies/$companyId/stations';
  static String stationById(String companyId, String id) => '/companies/$companyId/stations/$id';
  static String updateTankLevel(String companyId, String tankId) =>
      '/companies/$companyId/stations/tanks/$tankId/level';
}

class RouteNames {
  RouteNames._();

  static const splash = '/';
  static const login = '/login';
  static const forgotPassword = '/forgot-password';

  static const home = '/home';
  static const conversations = '/conversations';
  static const chat = '/conversations/:conversationId';
  static const newChat = '/conversations/new';
  static const newGroup = '/conversations/new-group';
  static const browseGroups = '/conversations/browse-groups';
  static const groupJoinRequests = '/conversations/:conversationId/join-requests';

  static const tasks = '/tasks';
  static const taskDetails = '/tasks/:taskId';

  static const approvals = '/approvals';
  static const approvalDetails = '/approvals/:approvalId';

  static const shift = '/shift';

  static const fuelRequests = '/fuel-requests';
  static const createFuelRequest = '/fuel-requests/new';
  static const fuelRequestDetails = '/fuel-requests/:fuelRequestId';

  static const stations = '/stations';
  static const stationTanks = '/stations/:stationId/tanks';

  static const attendance = '/attendance';

  static const profile = '/profile';
  static const languageSettings = '/profile/language';
  static const companyLanguages = '/profile/company-languages';

  static const safety = '/safety';
  static const safetyHazardReport = '/safety/hazard-report';
  static const safetySos = '/safety/sos';

  static String chatPath(String conversationId) => '/conversations/$conversationId';
  static String groupJoinRequestsPath(String conversationId) => '/conversations/$conversationId/join-requests';
  static String taskDetailsPath(String taskId) => '/tasks/$taskId';
  static String approvalDetailsPath(String approvalId) => '/approvals/$approvalId';
  static String fuelRequestDetailsPath(String id) => '/fuel-requests/$id';
  static String stationTanksPath(String stationId) => '/stations/$stationId/tanks';
}

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:get_it/get_it.dart';

import '../ai/speech_to_text_interface.dart';
import '../ai/text_to_speech_interface.dart';
import '../ai/translation_interface.dart';
import '../tts/tts_service.dart';
import '../network/dio_client.dart';
import '../network/interceptors/auth_interceptor.dart';
import '../network/network_info.dart';
import '../network/token_refresh_service.dart';
import '../network/websocket_client.dart';
import '../notifications/local_notification_service.dart';
import '../notifications/push_notification_service.dart';
import '../storage/local_database.dart';
import '../storage/offline_queue.dart';
import '../storage/secure_storage_service.dart';
import '../storage/sync_service.dart';

// Authentication
import '../../features/authentication/data/datasources/auth_remote_data_source.dart';
import '../../features/authentication/data/repositories/auth_repository_impl.dart';
import '../../features/authentication/domain/repositories/auth_repository.dart';
import '../../features/authentication/domain/usecases/get_current_user_usecase.dart';
import '../../features/authentication/domain/usecases/login_usecase.dart';
import '../../features/authentication/domain/usecases/logout_usecase.dart';
import '../../features/authentication/domain/usecases/update_preferred_language_usecase.dart';
import '../../features/authentication/domain/usecases/request_password_reset_usecase.dart';
import '../../features/authentication/domain/usecases/reset_password_usecase.dart';
import '../../features/authentication/presentation/bloc/auth_bloc.dart';

// Chat
import '../../features/chat/data/datasources/chat_remote_data_source.dart';
import '../../features/chat/data/datasources/chat_socket_data_source.dart';
import '../../features/chat/data/repositories/chat_repository_impl.dart';
import '../../features/chat/domain/repositories/chat_repository.dart';
import '../../features/chat/domain/usecases/get_conversations_usecase.dart';
import '../../features/chat/domain/usecases/get_messages_usecase.dart';
import '../../features/chat/domain/usecases/mark_read_usecase.dart';
import '../../features/chat/domain/usecases/send_text_message_usecase.dart';
import '../../features/chat/domain/usecases/send_voice_message_usecase.dart';
import '../../features/chat/presentation/bloc/chat_bloc.dart';
import '../../features/chat/presentation/bloc/conversations_bloc.dart';

// Tasks
import '../../features/tasks/data/datasources/tasks_remote_data_source.dart';
import '../../features/tasks/data/repositories/tasks_repository_impl.dart';
import '../../features/tasks/domain/repositories/tasks_repository.dart';
import '../../features/tasks/domain/usecases/tasks_usecases.dart';
import '../../features/tasks/presentation/bloc/task_detail_cubit.dart';
import '../../features/tasks/presentation/bloc/tasks_bloc.dart';

// Approvals
import '../../features/approvals/data/datasources/approvals_remote_data_source.dart';
import '../../features/approvals/data/repositories/approvals_repository_impl.dart';
import '../../features/approvals/domain/repositories/approvals_repository.dart';
import '../../features/approvals/domain/usecases/approvals_usecases.dart';
import '../../features/approvals/presentation/bloc/approvals_cubit.dart';

// Shift
import '../../features/shift/data/datasources/shift_remote_data_source.dart';
import '../../features/shift/data/repositories/shift_repository_impl.dart';
import '../../features/shift/domain/repositories/shift_repository.dart';
import '../../features/shift/domain/usecases/shift_usecases.dart';
import '../../features/shift/presentation/bloc/shift_cubit.dart';

// Fuel Requests
import '../../features/fuel_requests/data/datasources/fuel_requests_remote_data_source.dart';
import '../../features/fuel_requests/data/repositories/fuel_requests_repository_impl.dart';
import '../../features/fuel_requests/domain/repositories/fuel_requests_repository.dart';
import '../../features/fuel_requests/domain/usecases/fuel_requests_usecases.dart';
import '../../features/fuel_requests/presentation/bloc/fuel_requests_cubit.dart';

// Stations
import '../../features/stations/data/datasources/stations_remote_data_source.dart';
import '../../features/stations/data/repositories/stations_repository_impl.dart';
import '../../features/stations/domain/repositories/stations_repository.dart';
import '../../features/stations/domain/usecases/stations_usecases.dart';
import '../../features/stations/presentation/bloc/stations_cubit.dart';

// Profile / Settings
import '../../features/profile/data/repositories/settings_repository_impl.dart';
import '../../features/profile/domain/repositories/settings_repository.dart';
import '../../features/profile/presentation/bloc/settings_cubit.dart';

import '../../features/safety/data/datasources/safety_remote_data_source.dart';
import '../../features/safety/data/repositories/safety_repository_impl.dart';
import '../../features/safety/domain/repositories/safety_repository.dart';
import '../../features/safety/presentation/cubit/safety_cubit.dart';
import '../../features/directory/data/datasources/directory_remote_data_source.dart';
import '../../features/directory/data/repositories/directory_repository_impl.dart';
import '../../features/directory/domain/repositories/directory_repository.dart';
import '../../features/directory/presentation/cubit/directory_search_cubit.dart';

final GetIt sl = GetIt.instance;

/// Call once at app startup (see main.dart). Registration order matters:
/// core singletons first, then each feature's data -> domain -> presentation
/// layers, outermost-dependency-first (matches Clean Architecture's
/// dependency rule: presentation depends on domain depends on data
/// abstractions, never the reverse).
Future<void> initDependencyInjection() async {
  // ---- Core: external packages -------------------------------------------
  sl.registerLazySingleton(() => const FlutterSecureStorage());
  sl.registerLazySingleton(() => Connectivity());

  // ---- Core: storage --------------------------------------------------------
  sl.registerLazySingleton<SecureStorageService>(() => SecureStorageServiceImpl(sl()));
  sl.registerLazySingleton(() => LocalDatabase());
  sl.registerLazySingleton(() => OfflineQueueService(sl()));

  // ---- Core: network ----------------------------------------------------------
  sl.registerLazySingleton<NetworkInfo>(() => NetworkInfoImpl(sl()));
  sl.registerLazySingleton(() => TokenRefreshService(sl()));
  sl.registerLazySingleton(() => AuthInterceptor(
        secureStorage: sl(),
        tokenRefresh: sl(),
        onSessionExpired: () => sl<AuthBloc>().add(const AuthSessionExpired()),
      ));
  sl.registerLazySingleton(() => DioClient(authInterceptor: sl()));
  sl.registerLazySingleton(() => WebSocketClient(sl(), sl()));
  sl.registerLazySingleton(() => SyncService(sl(), sl(), sl()));

  // ---- Core: notifications + AI readiness interfaces -----------------------
  sl.registerLazySingleton<PushNotificationService>(() => FirebaseMessagingServiceStub());
  sl.registerLazySingleton(() => LocalNotificationService());
  sl.registerLazySingleton<SpeechToTextService>(() => NoopSpeechToTextService());
  sl.registerLazySingleton<TranslationService>(() => NoopTranslationService());
  sl.registerLazySingleton<TextToSpeechService>(() => NoopTextToSpeechService());

  // ==== Feature: Authentication ================================================
  sl.registerLazySingleton<AuthRemoteDataSource>(() => AuthRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(remote: sl(), secureStorage: sl(), networkInfo: sl()),
  );
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => LogoutUseCase(sl()));
  sl.registerLazySingleton(() => GetCurrentUserUseCase(sl()));
  sl.registerLazySingleton(() => RequestPasswordResetUseCase(sl()));
  sl.registerLazySingleton(() => ResetPasswordUseCase(sl()));
  sl.registerLazySingleton(() => UpdatePreferredLanguageUseCase(sl()));
  // Singleton: AuthBloc's status drives the whole app's router redirect
  // logic (see core/router/app_router.dart), so exactly one instance
  // must exist for the app's lifetime.
  sl.registerLazySingleton(() => AuthBloc(
        loginUseCase: sl(),
        logoutUseCase: sl(),
        getCurrentUserUseCase: sl(),
        updatePreferredLanguageUseCase: sl(),
      ));

  // TtsService — client-side, immediate spoken readout (see
  // core/tts/tts_service.dart for why this is distinct from
  // TextToSpeechService above). Registered here, right after AuthBloc,
  // since it reads the current user's preferredLanguage from it.
  // Deliberately NOT wired into any screen yet — per explicit
  // instruction, screens are connected in a follow-up pass.
  sl.registerLazySingleton<TtsService>(() => FlutterTtsServiceImpl(tts: FlutterTts(), authBloc: sl()));

  // ==== Feature: Chat ===========================================================
  sl.registerLazySingleton<ChatRemoteDataSource>(() => ChatRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton(() => ChatSocketDataSource(sl()));
  sl.registerLazySingleton<ChatRepository>(
    () => ChatRepositoryImpl(remote: sl(), socket: sl(), networkInfo: sl(), offlineQueue: sl()),
  );
  sl.registerLazySingleton(() => GetConversationsUseCase(sl()));
  sl.registerLazySingleton(() => GetMessagesUseCase(sl()));
  sl.registerLazySingleton(() => SendTextMessageUseCase(sl()));
  sl.registerLazySingleton(() => SendVoiceMessageUseCase(sl()));
  sl.registerLazySingleton(() => MarkReadUseCase(sl()));
  sl.registerFactoryParam<ConversationsBloc, String, void>(
    (companyId, _) => ConversationsBloc(getConversations: sl(), chatRepository: sl(), companyId: companyId),
  );
  sl.registerFactoryParam<ChatBloc, String, String>(
    (companyId, conversationId) => ChatBloc(
      companyId: companyId,
      conversationId: conversationId,
      repository: sl(),
      getMessages: sl(),
      sendTextMessage: sl(),
      sendVoiceMessage: sl(),
      markRead: sl(),
    ),
  );

  // ==== Feature: Tasks ===========================================================
  sl.registerLazySingleton<TasksRemoteDataSource>(() => TasksRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<TasksRepository>(() => TasksRepositoryImpl(sl()));
  sl.registerLazySingleton(() => GetTasksUseCase(sl()));
  sl.registerLazySingleton(() => GetTaskUseCase(sl()));
  sl.registerLazySingleton(() => SubmitTaskResponseUseCase(sl()));
  sl.registerLazySingleton(() => UploadTaskAttachmentUseCase(sl()));
  sl.registerFactoryParam<TasksBloc, String, String>(
    (companyId, currentUserId) => TasksBloc(getTasks: sl(), companyId: companyId, currentUserId: currentUserId),
  );
  sl.registerFactoryParam<TaskDetailCubit, String, String>(
    (companyId, taskId) => TaskDetailCubit(
      getTask: sl(),
      submitResponse: sl(),
      uploadAttachment: sl(),
      companyId: companyId,
      taskId: taskId,
    ),
  );

  // ==== Feature: Approvals ========================================================
  sl.registerLazySingleton<ApprovalsRemoteDataSource>(() => ApprovalsRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<ApprovalsRepository>(() => ApprovalsRepositoryImpl(sl()));
  sl.registerLazySingleton(() => GetMyPendingApprovalsUseCase(sl()));
  sl.registerLazySingleton(() => ActOnApprovalUseCase(sl()));
  sl.registerFactoryParam<ApprovalsCubit, String, void>(
    (companyId, _) => ApprovalsCubit(getMyPendingApprovals: sl(), actOnApproval: sl(), companyId: companyId),
  );

  // ==== Feature: Shift ============================================================
  sl.registerLazySingleton<ShiftRemoteDataSource>(() => ShiftRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<ShiftRepository>(() => ShiftRepositoryImpl(sl()));
  sl.registerLazySingleton(() => GetShiftsUseCase(sl()));
  sl.registerLazySingleton(() => GetMyShiftLogsUseCase(sl()));
  sl.registerLazySingleton(() => OpenShiftUseCase(sl()));
  sl.registerLazySingleton(() => CloseShiftUseCase(sl()));
  sl.registerFactoryParam<ShiftCubit, String, void>(
    (companyId, _) => ShiftCubit(getShifts: sl(), getMyShiftLogs: sl(), openShift: sl(), closeShift: sl(), companyId: companyId),
  );

  // ==== Feature: Fuel Requests =====================================================
  sl.registerLazySingleton<FuelRequestsRemoteDataSource>(() => FuelRequestsRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<FuelRequestsRepository>(() => FuelRequestsRepositoryImpl(sl()));
  sl.registerLazySingleton(() => GetFuelRequestsUseCase(sl()));
  sl.registerLazySingleton(() => GetFuelRequestUseCase(sl()));
  sl.registerLazySingleton(() => CreateFuelRequestUseCase(sl()));
  sl.registerFactoryParam<FuelRequestsCubit, String, void>(
    (companyId, _) => FuelRequestsCubit(getFuelRequests: sl(), createFuelRequest: sl(), companyId: companyId),
  );

  // ==== Feature: Stations ===========================================================
  sl.registerLazySingleton<StationsRemoteDataSource>(() => StationsRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<StationsRepository>(() => StationsRepositoryImpl(sl()));
  sl.registerLazySingleton(() => GetStationsUseCase(sl()));
  sl.registerLazySingleton(() => GetStationUseCase(sl()));
  sl.registerLazySingleton(() => UpdateTankLevelUseCase(sl()));
  sl.registerFactoryParam<StationsCubit, String, void>(
    (companyId, _) => StationsCubit(getStations: sl(), updateTankLevel: sl(), companyId: companyId),
  );

  // ==== Feature: Profile / Settings ==================================================
  sl.registerLazySingleton<SettingsRepository>(() => SettingsRepositoryImpl(sl()));
  sl.registerLazySingleton(() => SettingsCubit(sl()));

  // ==== Feature: Safety (T8) =========================================================
  sl.registerLazySingleton<SafetyRemoteDataSource>(() => SafetyRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<SafetyRepository>(() => SafetyRepositoryImpl(remote: sl(), networkInfo: sl()));
  sl.registerFactoryParam<SafetyCubit, String, void>(
    (companyId, _) => SafetyCubit(repository: sl(), companyId: companyId),
  );

  // ==== Feature: Directory (user search + group creation) ============================
  sl.registerLazySingleton<DirectoryRemoteDataSource>(() => DirectoryRemoteDataSourceImpl(sl()));
  sl.registerLazySingleton<DirectoryRepository>(() => DirectoryRepositoryImpl(remote: sl(), networkInfo: sl()));
  sl.registerFactoryParam<DirectorySearchCubit, String, void>(
    (companyId, _) => DirectorySearchCubit(repository: sl(), companyId: companyId),
  );
}

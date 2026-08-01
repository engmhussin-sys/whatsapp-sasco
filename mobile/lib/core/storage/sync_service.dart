import 'dart:async';
import '../network/dio_client.dart';
import '../network/network_info.dart';
import 'offline_queue.dart';

/// Listens for connectivity changes and, once back online, replays every
/// queued write in order (oldest first). A request is dropped from the
/// queue after 5 failed attempts to avoid retrying something permanently
/// broken (e.g. a validation error) forever — this mirrors a dead-letter
/// pattern rather than looping indefinitely.
class SyncService {
  final OfflineQueueService _queue;
  final DioClient _dioClient;
  final NetworkInfo _networkInfo;
  StreamSubscription<bool>? _connectivitySub;

  static const int _maxRetries = 5;

  SyncService(this._queue, this._dioClient, this._networkInfo);

  void start() {
    _connectivitySub = _networkInfo.onConnectivityChanged.listen((isConnected) {
      if (isConnected) flushQueue();
    });
  }

  Future<void> flushQueue() async {
    final pending = await _queue.getAll();
    for (final request in pending) {
      if (request.retryCount >= _maxRetries) {
        await _queue.remove(request.id);
        continue;
      }
      try {
        switch (request.method) {
          case 'POST':
            await _dioClient.post(request.path, data: request.body);
            break;
          case 'PATCH':
            await _dioClient.patch(request.path, data: request.body);
            break;
          case 'DELETE':
            await _dioClient.delete(request.path);
            break;
        }
        await _queue.remove(request.id);
      } catch (e) {
        await _queue.incrementRetry(request.id, e.toString());
      }
    }
  }

  void dispose() {
    _connectivitySub?.cancel();
  }
}

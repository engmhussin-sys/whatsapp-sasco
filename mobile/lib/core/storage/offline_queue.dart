import 'dart:convert';
import 'package:uuid/uuid.dart';
import 'local_database.dart';

class PendingRequest {
  final String id;
  final String method; // 'POST' | 'PATCH' | 'DELETE'
  final String path;
  final Map<String, dynamic>? body;
  final DateTime createdAt;
  final int retryCount;

  PendingRequest({
    required this.id,
    required this.method,
    required this.path,
    this.body,
    required this.createdAt,
    this.retryCount = 0,
  });

  factory PendingRequest.fromRow(Map<String, Object?> row) => PendingRequest(
        id: row['id'] as String,
        method: row['method'] as String,
        path: row['path'] as String,
        body: row['body_json'] != null ? jsonDecode(row['body_json'] as String) as Map<String, dynamic> : null,
        createdAt: DateTime.fromMillisecondsSinceEpoch(row['created_at'] as int),
        retryCount: row['retry_count'] as int,
      );
}

/// Durable queue for write operations attempted while offline.
///
/// SCOPE NOTE (honest about what's wired up in this delivery): the queue
/// itself, enqueue/dequeue, and SyncService's replay loop are fully
/// implemented and usable today. What is NOT yet done is wiring EVERY
/// feature repository to automatically enqueue on network failure —
/// only ChatRepositoryImpl.sendTextMessage does this today, as the
/// reference implementation (see features/chat/data/repositories).
/// Extending the same three-line pattern to other repositories is
/// mechanical and intentionally left for when those flows are prioritized,
/// per the "even if not all features activated now" scope given for Phase 1.
class OfflineQueueService {
  final LocalDatabase _localDb;
  final _uuid = const Uuid();

  OfflineQueueService(this._localDb);

  Future<void> enqueue({
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    final db = await _localDb.database;
    await db.insert('pending_requests', {
      'id': _uuid.v4(),
      'method': method,
      'path': path,
      'body_json': body != null ? jsonEncode(body) : null,
      'created_at': DateTime.now().millisecondsSinceEpoch,
      'retry_count': 0,
    });
  }

  Future<List<PendingRequest>> getAll() async {
    final db = await _localDb.database;
    final rows = await db.query('pending_requests', orderBy: 'created_at ASC');
    return rows.map(PendingRequest.fromRow).toList();
  }

  Future<void> remove(String id) async {
    final db = await _localDb.database;
    await db.delete('pending_requests', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> incrementRetry(String id, String error) async {
    final db = await _localDb.database;
    await db.rawUpdate(
      'UPDATE pending_requests SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
      [error, id],
    );
  }
}

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Offline-first foundation (Phase 1 scope: schema + basic read/write ready,
/// NOT yet wired into every feature's repository — see OfflineQueueService's
/// doc comment for exactly what IS wired up in this delivery vs. left as a
/// ready-to-extend pattern).
///
/// Two tables:
/// - `cache_entries`: generic key/value read-through cache (JSON blobs) so
///   list screens can render last-known data instantly while a fresh
///   network request is in flight, and something is still shown if that
///   request fails offline.
/// - `pending_requests`: a durable queue of writes attempted while offline
///   (or that failed with a network error), to be replayed once
///   connectivity returns. See OfflineQueueService.
class LocalDatabase {
  static Database? _db;
  static const String _dbName = 'workforce_connect.db';
  static const int _dbVersion = 1;

  Future<Database> get database async {
    _db ??= await _init();
    return _db!;
  }

  Future<Database> _init() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return openDatabase(
      path,
      version: _dbVersion,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE cache_entries (
            cache_key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )
        ''');

        await db.execute('''
          CREATE TABLE pending_requests (
            id TEXT PRIMARY KEY,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            body_json TEXT,
            created_at INTEGER NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
          )
        ''');
      },
    );
  }

  // ---- Generic cache -----------------------------------------------------

  Future<void> putCache(String key, String valueJson) async {
    final db = await database;
    await db.insert(
      'cache_entries',
      {
        'cache_key': key,
        'value_json': valueJson,
        'updated_at': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> getCache(String key) async {
    final db = await database;
    final rows = await db.query('cache_entries', where: 'cache_key = ?', whereArgs: [key], limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['value_json'] as String;
  }

  Future<void> clearCache() async {
    final db = await database;
    await db.delete('cache_entries');
  }
}

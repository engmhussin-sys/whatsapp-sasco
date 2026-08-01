import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../error/failures.dart';

/// Base contract every UseCase implements: takes [Params], returns
/// `Either<Failure, Type>`. Kept generic (not Injectable-annotated) since
/// this project uses manual get_it registration — see core/di.
abstract class UseCase<Type, Params> {
  Future<Either<Failure, Type>> call(Params params);
}

/// For usecases that take no parameters (e.g. GetCurrentUser, Logout).
class NoParams extends Equatable {
  const NoParams();
  @override
  List<Object?> get props => [];
}

// Local copy of shared InternalKeyGuard so Docker builds that only
// COPY services/zk-vault still compile and run.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-internal-key'];
    // Allow missing key only when explicitly in test mode without auth
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('INTERNAL_API_KEY is not configured');
    }
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}

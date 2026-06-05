// Shared guard for internal service-to-service calls
// Apply to any controller endpoint that should only be called by other backend services

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
    if (!key || key !== process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}

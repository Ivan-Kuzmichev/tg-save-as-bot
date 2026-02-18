import { logger } from '../utils/logger';

class AccessControl {
  private allowedUserIds: Set<number>;

  constructor(allowedUserIdsEnv: string) {
    this.allowedUserIds = new Set(
      allowedUserIdsEnv
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id))
    );

    logger.info({ allowedUserIds: Array.from(this.allowedUserIds) }, 'Access control initialized');
  }

  isAllowed(userId: number): boolean {
    return this.allowedUserIds.has(userId);
  }

  getAllowedUserIds(): number[] {
    return Array.from(this.allowedUserIds);
  }
}

export { AccessControl };

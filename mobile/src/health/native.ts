import type { AppleHealthNative } from './types';

/** Web / Android: HealthKit does not exist here. */
const native: AppleHealthNative = {
  async isSupported() {
    return false;
  },
  async requestAccess() {
    return false;
  },
  async readDailySummaries() {
    return [];
  },
};

export default native;

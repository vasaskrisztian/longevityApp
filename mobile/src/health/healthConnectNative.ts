import type { HealthConnectNative } from './healthConnectTypes';

/** Web / iPhone: Health Connect does not exist here. */
const native: HealthConnectNative = {
  async availability() {
    return 'unsupported';
  },
  async getAccess() {
    return { granted: false, background: false, history: false };
  },
  async requestAccess() {
    return { granted: false, background: false, history: false };
  },
  async readDailySummaries() {
    return [];
  },
  openSettings() {},
};

export default native;

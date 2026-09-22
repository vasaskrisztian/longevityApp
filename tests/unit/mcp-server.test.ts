import { describe, it, expect, vi, beforeEach } from 'vitest';

const connectMock = vi.fn();
const McpServerMock = vi.fn().mockImplementation((serverInfo: unknown) => ({
  serverInfo,
  connect: connectMock,
}));
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({ McpServer: McpServerMock }));

const StdioServerTransportMock = vi.fn().mockImplementation(() => ({ kind: 'stdio-transport' }));
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: StdioServerTransportMock,
}));

const CTX = { userId: 'user-1' };
const resolveMcpAuthContextFromEnvMock = vi.fn(() => CTX);
vi.mock('@/mcp/auth-context', () => ({
  resolveMcpAuthContextFromEnv: resolveMcpAuthContextFromEnvMock,
}));

const FAKE_GATEWAY = { kind: 'fake-gateway' };
const createHealthMcpGatewayMock = vi.fn(() => FAKE_GATEWAY);
vi.mock('@/mcp/gateway', () => ({ createHealthMcpGateway: createHealthMcpGatewayMock }));

const registerHealthToolsMock = vi.fn();
vi.mock('@/mcp/tools/register-health-tools', () => ({ registerHealthTools: registerHealthToolsMock }));

const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logging/logger', () => ({ logger: loggerMock }));

const { startMcpServer } = await import('@/mcp/server');

beforeEach(() => {
  vi.clearAllMocks();
  connectMock.mockResolvedValue(undefined);
  resolveMcpAuthContextFromEnvMock.mockReturnValue(CTX);
  createHealthMcpGatewayMock.mockReturnValue(FAKE_GATEWAY);
});

describe('startMcpServer', () => {
  it('resolves the auth context and gateway before wiring anything else', async () => {
    await startMcpServer();

    expect(resolveMcpAuthContextFromEnvMock).toHaveBeenCalled();
    expect(createHealthMcpGatewayMock).toHaveBeenCalled();
  });

  it('constructs an McpServer with a name/version and registers the five health tools against it', async () => {
    await startMcpServer();

    expect(McpServerMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.any(String), version: expect.any(String) }),
    );
    expect(registerHealthToolsMock).toHaveBeenCalledWith(
      McpServerMock.mock.results[0]?.value,
      FAKE_GATEWAY,
      CTX,
    );
  });

  it('connects a StdioServerTransport to the server', async () => {
    await startMcpServer();

    expect(StdioServerTransportMock).toHaveBeenCalled();
    expect(connectMock).toHaveBeenCalledWith(StdioServerTransportMock.mock.results[0]?.value);
  });

  it('logs a startup message naming every tool', async () => {
    await startMcpServer();

    expect(loggerMock.info).toHaveBeenCalledWith(
      'mcp_server_started',
      expect.objectContaining({
        tools: 'get_user_daily_health, get_user_sleep_trend, get_user_readiness_trend, get_user_activity_trend, get_user_health_summary',
      }),
    );
  });

  it('propagates a configuration error from resolveMcpAuthContextFromEnv instead of connecting anything', async () => {
    const configError = new Error('MCP_USER_ID is not set.');
    resolveMcpAuthContextFromEnvMock.mockImplementation(() => {
      throw configError;
    });

    await expect(startMcpServer()).rejects.toThrow(configError);
    expect(McpServerMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHealthTools } from '@/mcp/tools/register-health-tools';
import type { HealthMcpGateway, McpAuthContext } from '@/mcp/gateway';

/**
 * A fake McpServer that only implements the one method register-health-tools
 * calls, capturing each (name, config, callback) triple so this file can
 * inspect the exact schema shape registered and invoke each handler
 * directly, without needing a real MCP client/transport.
 */
function createFakeServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: (...args: unknown[]) => unknown }>();
  return {
    registerTool: vi.fn(
      (name: string, config: Record<string, unknown>, handler: (...args: unknown[]) => unknown) => {
        tools.set(name, { config, handler });
      },
    ),
    tools,
  };
}

/** Every handler here returns CallToolResult's well-known { content: [{type:'text', text}] } shape with exactly one text part — this pulls that part's JSON body out. */
function parseFirstTextResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  const [first] = result.content;
  if (!first) {
    throw new Error('Expected at least one content part in the tool result');
  }
  return JSON.parse(first.text);
}

function createFakeGateway(): { [K in keyof HealthMcpGateway]: ReturnType<typeof vi.fn> } {
  return {
    getHealthSummary: vi.fn(),
    getSleepContext: vi.fn(),
    getRecoveryContext: vi.fn(),
    getActivityContext: vi.fn(),
  };
}

const EXPECTED_TOOL_NAMES = [
  'get_user_daily_health',
  'get_user_sleep_trend',
  'get_user_readiness_trend',
  'get_user_activity_trend',
  'get_user_health_summary',
];

let server: ReturnType<typeof createFakeServer>;
let gateway: ReturnType<typeof createFakeGateway>;
const CTX: McpAuthContext = { userId: 'user-1' };

beforeEach(() => {
  server = createFakeServer();
  gateway = createFakeGateway();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerHealthTools(server as any, gateway as unknown as HealthMcpGateway, CTX);
});

describe('registerHealthTools', () => {
  it('registers exactly the five tools ARCHITECTURE.md §9 names, no more and no fewer', () => {
    expect(server.registerTool).toHaveBeenCalledTimes(5);
    expect([...server.tools.keys()].sort()).toEqual([...EXPECTED_TOOL_NAMES].sort());
  });

  it('no tool\'s input schema declares a userId field — structurally impossible for a model to supply one', () => {
    for (const name of EXPECTED_TOOL_NAMES) {
      const { config } = server.tools.get(name)!;
      const inputSchema = (config.inputSchema ?? {}) as Record<string, unknown>;
      const keys = Object.keys(inputSchema).map((k) => k.toLowerCase());
      expect(keys.some((k) => k.includes('userid'))).toBe(false);
    }
  });

  it('every tool has a non-empty title and description (so a model sees what it does before calling it)', () => {
    for (const name of EXPECTED_TOOL_NAMES) {
      const { config } = server.tools.get(name)!;
      expect(typeof config.title).toBe('string');
      expect((config.title as string).length).toBeGreaterThan(0);
      expect(typeof config.description).toBe('string');
      expect((config.description as string).length).toBeGreaterThan(0);
    }
  });
});

describe('get_user_daily_health handler', () => {
  it('resolves the gateway call with the injected ctx (never a caller-supplied id) and returns available:true with the summary', async () => {
    gateway.getHealthSummary.mockResolvedValue({ date: '2026-06-15', isToday: true, sourceProviders: ['OURA'] });
    const { handler } = server.tools.get('get_user_daily_health')!;

    const result = (await handler()) as { content: Array<{ type: string; text: string }> };

    expect(gateway.getHealthSummary).toHaveBeenCalledWith(CTX);
    const body = parseFirstTextResult(result);
    expect(body).toEqual({
      available: true,
      summary: { date: '2026-06-15', isToday: true, sourceProviders: ['OURA'] },
    });
  });

  it('returns available:false when the gateway has no data for this user yet', async () => {
    gateway.getHealthSummary.mockResolvedValue(null);
    const { handler } = server.tools.get('get_user_daily_health')!;

    const result = (await handler()) as { content: Array<{ type: string; text: string }> };

    const body = parseFirstTextResult(result) as { available: boolean };
    expect(body.available).toBe(false);
  });
});

describe.each([
  ['get_user_sleep_trend', 'getSleepContext'] as const,
  ['get_user_readiness_trend', 'getRecoveryContext'] as const,
  ['get_user_activity_trend', 'getActivityContext'] as const,
])('%s handler', (toolName, gatewayMethod) => {
  it(`calls gateway.${gatewayMethod} with the injected ctx and the requested rangeDays`, async () => {
    gateway[gatewayMethod].mockResolvedValue({ rangeDays: 30, points: [] });
    const { handler } = server.tools.get(toolName)!;

    const result = (await handler({ rangeDays: 30 })) as { content: Array<{ type: string; text: string }> };

    expect(gateway[gatewayMethod]).toHaveBeenCalledWith(CTX, { rangeDays: 30 });
    expect(parseFirstTextResult(result)).toEqual({ rangeDays: 30, points: [] });
  });
});

describe('get_user_health_summary handler', () => {
  it('combines all four gateway calls into one composite result, all bound to the same injected ctx', async () => {
    gateway.getHealthSummary.mockResolvedValue({ date: '2026-06-15' });
    gateway.getSleepContext.mockResolvedValue({ rangeDays: 7, points: ['sleep'] });
    gateway.getRecoveryContext.mockResolvedValue({ rangeDays: 7, points: ['recovery'] });
    gateway.getActivityContext.mockResolvedValue({ rangeDays: 7, points: ['activity'] });
    const { handler } = server.tools.get('get_user_health_summary')!;

    const result = (await handler({ rangeDays: 7 })) as { content: Array<{ type: string; text: string }> };

    expect(gateway.getHealthSummary).toHaveBeenCalledWith(CTX);
    expect(gateway.getSleepContext).toHaveBeenCalledWith(CTX, { rangeDays: 7 });
    expect(gateway.getRecoveryContext).toHaveBeenCalledWith(CTX, { rangeDays: 7 });
    expect(gateway.getActivityContext).toHaveBeenCalledWith(CTX, { rangeDays: 7 });
    expect(parseFirstTextResult(result)).toEqual({
      latest: { date: '2026-06-15' },
      sleep: { rangeDays: 7, points: ['sleep'] },
      recovery: { rangeDays: 7, points: ['recovery'] },
      activity: { rangeDays: 7, points: ['activity'] },
    });
  });
});

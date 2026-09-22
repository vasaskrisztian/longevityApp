import { describe, it, expect } from 'vitest';
import { resolveMcpAuthContextFromEnv, McpConfigurationError } from '@/mcp/auth-context';

describe('resolveMcpAuthContextFromEnv', () => {
  it('returns an McpAuthContext carrying MCP_USER_ID when it is set', () => {
    const ctx = resolveMcpAuthContextFromEnv({ MCP_USER_ID: 'user-42' } as unknown as NodeJS.ProcessEnv);

    expect(ctx).toEqual({ userId: 'user-42' });
  });

  it('throws McpConfigurationError when MCP_USER_ID is missing', () => {
    expect(() => resolveMcpAuthContextFromEnv({} as unknown as NodeJS.ProcessEnv)).toThrow(McpConfigurationError);
  });

  it('throws McpConfigurationError when MCP_USER_ID is an empty/whitespace string', () => {
    expect(() => resolveMcpAuthContextFromEnv({ MCP_USER_ID: '   ' } as unknown as NodeJS.ProcessEnv)).toThrow(
      McpConfigurationError,
    );
  });

  it('error message points to how to fix the configuration', () => {
    expect(() => resolveMcpAuthContextFromEnv({} as unknown as NodeJS.ProcessEnv)).toThrow(/MCP_USER_ID/);
  });

  it('defaults to process.env when no env object is passed', () => {
    const original = process.env.MCP_USER_ID;
    process.env.MCP_USER_ID = 'from-process-env';
    try {
      expect(resolveMcpAuthContextFromEnv()).toEqual({ userId: 'from-process-env' });
    } finally {
      if (original === undefined) {
        delete process.env.MCP_USER_ID;
      } else {
        process.env.MCP_USER_ID = original;
      }
    }
  });
});

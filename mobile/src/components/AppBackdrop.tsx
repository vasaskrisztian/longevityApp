import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/src/theme/tokens';

const W = 1000;
const H = 800;

/** A closed, slightly irregular ring (a tree ring) as an SVG path. Pure and
 * deterministic, so the picture is identical on every render and platform. */
function ringPath(cx: number, cy: number, radius: number, seed: number): string {
  const steps = 120;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const wobble = 1 + 0.035 * Math.sin(3 * t + seed) + 0.02 * Math.sin(5 * t + seed * 2.3) + 0.012 * Math.sin(9 * t + seed * 0.7);
    const x = cx + Math.cos(t) * radius * wobble;
    const y = cy + Math.sin(t) * radius * wobble * 0.92;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return `${d}Z`;
}

/**
 * The discreet picture behind the main content: two very soft colour glows
 * (forest green top right, gold bottom left) and a set of faint "tree rings"
 * growing out of the bottom-right corner — a quiet nod to the tree in the
 * seal and to longevity. Everything is a few percent opacity so cards and
 * text stay in front; it never intercepts touches.
 */
export function AppBackdrop() {
  const rings = useMemo(() => {
    const out: { d: string; gold: boolean; opacity: number }[] = [];
    for (let i = 0; i < 11; i += 1) {
      const radius = 70 + i * 58;
      out.push({ d: ringPath(880, 760, radius, 1.3 + i * 0.37), gold: i % 4 === 2, opacity: 0.075 - i * 0.004 });
    }
    return out;
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMax slice">
        <Defs>
          <RadialGradient id="glowGreen" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={colors.primary.default} stopOpacity="0.10" />
            <Stop offset="1" stopColor={colors.primary.default} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glowGold" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={colors.accent.light} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.accent.light} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={W * 0.92} cy={H * 0.02} r={420} fill="url(#glowGreen)" />
        <Circle cx={W * 0.04} cy={H * 0.98} r={460} fill="url(#glowGold)" />
        {rings.map((ring, index) => (
          <Path
            key={index}
            d={ring.d}
            fill="none"
            stroke={ring.gold ? colors.accent.default : colors.primary.default}
            strokeOpacity={ring.gold ? ring.opacity * 1.2 : ring.opacity}
            strokeWidth={1.2}
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * For the four tab-root screens on iOS/Android, where the screens must stay
 * opaque for the native transitions: draws the same picture inside the screen
 * itself. On the web the backdrop is drawn once behind the whole content area
 * (see (tabs)/_layout.tsx and DesktopShell), so this renders nothing there.
 */
export function ScreenBackdrop() {
  return Platform.OS === 'web' ? null : <AppBackdrop />;
}

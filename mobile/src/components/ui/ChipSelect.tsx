import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, radii } from '@/src/theme/tokens';

export interface ChipOption {
  value: string;
  label: string;
}

/**
 * Replaces the web app's native <select>/checkbox-list for every enum field
 * (gender, activity level, diet type, goal type/status, supplement
 * frequency/timing, activity types) — React Native has no built-in <select>,
 * and a wrapping row of pressable chips needs no native picker dependency
 * (same reasoning that kept the Trends charts off a third-party library:
 * fewer things to verify work on react-native-web). Label text comes from
 * validation/schemas.ts's enumLabel().
 */

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.card.default,
  },
  chipActive: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  chipText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.foreground,
  },
  chipTextActive: {
    color: colors.primary.foreground,
  },
  label: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.foreground,
    marginBottom: 6,
  },
});

export function ChipSingleSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChipOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <View>
      <Text style={chipStyles.label}>{label}</Text>
      <View style={chipStyles.row}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[chipStyles.chip, active && chipStyles.chipActive]}
            >
              <Text style={[chipStyles.chipText, active && chipStyles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ChipMultiSelect({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: readonly ChipOption[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  return (
    <View>
      <Text style={chipStyles.label}>{label}</Text>
      <View style={chipStyles.row}>
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggle(option.value)}
              style={[chipStyles.chip, active && chipStyles.chipActive]}
            >
              <Text style={[chipStyles.chipText, active && chipStyles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

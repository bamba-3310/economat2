import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { theme, type } from "../lib/theme";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={type.eyebrow}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const tones = {
    neutral: { backgroundColor: theme.lineSoft, color: theme.ink },
    ok: { backgroundColor: theme.okSoft, color: theme.ok },
    warn: { backgroundColor: theme.warnSoft, color: theme.warn },
    danger: { backgroundColor: theme.dangerSoft, color: theme.danger },
  } as const;
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.backgroundColor }]}>
      <Text style={[styles.chipText, { color: t.color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "line" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary && { backgroundColor: theme.ink, borderColor: theme.ink },
        isDanger && { borderColor: theme.danger },
        variant === "ghost" && { borderColor: "transparent" },
        (disabled || loading) && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? theme.surface : theme.ink} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: isPrimary ? theme.surface : isDanger ? theme.danger : theme.ink },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        placeholderTextColor={theme.muted}
        style={styles.input}
        autoCapitalize="none"
        {...rest}
      />
    </View>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: theme.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: theme.ink, fontSize: 13, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepperButton}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        style={styles.stepperButton}
        onPress={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
      >
        <Text style={styles.stepperSign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    padding: 16,
    gap: 12,
  },
  chip: {
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  chipText: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.ink,
    borderRadius: 3,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    borderRadius: 3,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.ink,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.lineSoft,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  stepperButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  stepperSign: {
    fontSize: 18,
    color: theme.ink,
  },
  stepperValue: {
    minWidth: 48,
    textAlign: "center",
    fontSize: 16,
    color: theme.ink,
    fontVariant: ["tabular-nums"],
  },
});

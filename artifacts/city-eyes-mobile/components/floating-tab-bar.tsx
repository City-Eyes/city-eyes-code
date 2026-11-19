import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Tabs } from "expo-router";
import { useColors } from "@workspace/city-eyes-system/hooks/use-colors";

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const HEIGHT = 64;
const RADIUS = 20;
const NOTCH_DEPTH = 36;
const NOTCH_HALF = 42;
const FAB = 56;
const FAB_LIFT = 22;

const AnimatedPath = Animated.createAnimatedComponent(Path);

function clampCenter(center: number, width: number) {
  "worklet";
  return Math.min(Math.max(center, RADIUS + NOTCH_HALF), width - RADIUS - NOTCH_HALF);
}

// Worklet: roda na UI thread para acompanhar o spring sem passar pelo JS.
function barPath(width: number, height: number, center: number) {
  "worklet";
  const r = RADIUS;
  const c = clampCenter(center, width);
  const d = NOTCH_DEPTH;
  return [
    `M${r},0`,
    `H${c - NOTCH_HALF}`,
    `C${c - NOTCH_HALF + 14},0 ${c - 30},${d} ${c},${d}`,
    `C${c + 30},${d} ${c + NOTCH_HALF - 14},0 ${c + NOTCH_HALF},0`,
    `H${width - r}`,
    `A${r},${r} 0 0 1 ${width},${r}`,
    `V${height}`,
    `H0`,
    `V${r}`,
    `A${r},${r} 0 0 1 ${r},0`,
    "Z",
  ].join(" ");
}

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const height = HEIGHT + insets.bottom;
  const slot = width / state.routes.length;

  const center = useSharedValue(slot * (state.index + 0.5));
  useEffect(() => {
    center.value = withSpring(slot * (state.index + 0.5), { damping: 20, stiffness: 190, mass: 0.8 });
  }, [center, state.index, slot]);

  const pathProps = useAnimatedProps(() => ({ d: barPath(width, height, center.value) }));
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: clampCenter(center.value, width) - FAB / 2 }],
  }));

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const onPress = () => {
      const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };
    return { route, options, focused, onPress };
  });
  const active = items[state.index];

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={{ height, width }}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <AnimatedPath animatedProps={pathProps} fill={colors.primary as string} />
        </Svg>
        <View style={styles.row}>
          {items.map(({ route, options, focused, onPress }) => {
            const color = (focused ? colors.primaryForeground : colors.primaryForeground + "99") as string;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                style={styles.item}
              >
                <View style={[styles.icon, focused && styles.hidden]}>
                  {options.tabBarIcon?.({ focused, color, size: 24 })}
                </View>
                <Text numberOfLines={1} style={[styles.label, { color }]}>
                  {options.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Animated.View style={[styles.fabWrap, fabStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={active.options.tabBarAccessibilityLabel}
            onPress={active.onPress}
            style={[styles.fab, { backgroundColor: colors.accent as string }]}
          >
            {active.options.tabBarIcon?.({ focused: true, color: colors.accentForeground as string, size: 24 })}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", overflow: "visible" },
  row: { alignItems: "center", flexDirection: "row", height: HEIGHT },
  item: { alignItems: "center", flex: 1, gap: 2, justifyContent: "center" },
  icon: { alignItems: "center", height: 24, justifyContent: "center", width: 24 },
  hidden: { opacity: 0 },
  label: { fontSize: 11, fontWeight: "600" },
  fabWrap: { left: 0, position: "absolute", top: -FAB_LIFT },
  fab: {
    alignItems: "center",
    borderRadius: 999,
    elevation: 6,
    height: FAB,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: FAB,
  },
});

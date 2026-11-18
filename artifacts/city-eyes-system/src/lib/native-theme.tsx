import { tokens } from "../generated/tokens";

function cssLengthToPixels(value: string) {
  const amount = Number.parseFloat(value);
  return value.endsWith("rem") ? amount * 16 : amount;
}

const spacingUnit = cssLengthToPixels(tokens.spacing);

export const nativeTheme = {
  colors: tokens.color,
  radius: cssLengthToPixels(tokens.radius),
  spacing: {
    unit: spacingUnit,
    xs: spacingUnit,
    sm: spacingUnit * 2,
    md: spacingUnit * 3,
    lg: spacingUnit * 4,
    xl: spacingUnit * 6,
    xxl: spacingUnit * 8,
  },
  typography: {
    display: 25,
    title: 21,
    body: 14,
    small: 12,
    caption: 10,
  },
  fontFamily: {
    regular: "NunitoSans_400Regular",
    medium: "NunitoSans_500Medium",
    semiBold: "NunitoSans_600SemiBold",
    bold: "NunitoSans_700Bold",
  },
} as const;

export type NativeColors = typeof nativeTheme.colors.light;
export type NativeTypographyVariant =
  | "display"
  | "title"
  | "body"
  | "muted"
  | "small"
  | "caption"
  | "eyebrow";

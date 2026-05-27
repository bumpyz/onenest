// MemberAvatar — colored circle with the member's first initial. This is the
// `CAvatar` from the design handoff, ported to RN. Used everywhere a person
// appears in the new design: header user chip, member rows, task assignees,
// custody mini-bar segments, contact lists.
//
// Background = member's stored color (from members.color / children.color).
// Foreground = white (forest accent dark-mode rule doesn't apply here — the
// member colors are saturated enough that white reads on all of them).
//
// Sizes are deliberate, not arbitrary: the design uses a tight set
// (sm 18, md 24, lg 32, xl 56, hero 84). Bigger sizes scale the font
// proportionally; the initial is always ~40% of the diameter.

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/theme';

export type AvatarSize = 'sm' | 'chip' | 'pickerLead' | 'md' | 'lg' | 'xl' | 'hero';

const SIZE_PX: Record<AvatarSize, number> = {
    sm: 18,
    // chip = 20px, used by ResponsibleChip (event-responsible bundle). Sits
    // between sm and md so the chip's overall height (4 + 20 + 4 = 28) holds
    // the design spec without rolling our own circle inline.
    chip: 20,
    // pickerLead = 22px, used by EventResponsibleSheet's lead-picker card
    // (design source line 668). A dedicated size avoids drifting to 'md'
    // (24px) and breaking the picker's vertical rhythm by 2px.
    pickerLead: 22,
    md: 24,
    lg: 32,
    xl: 56,
    hero: 84,
};

type Props = {
    /** Person's display name. First letter gets uppercased and rendered. */
    name: string;
    /** Background hex. Pass the member's stored color directly. */
    color: string;
    size?: AvatarSize;
    /** Optional border color — used by MemberStack to inset overlapping avatars
     *  with a card-color rim so they read as distinct rather than blending. */
    borderColor?: string;
};

export function MemberAvatar({ name, color, size = 'md', borderColor }: Props) {
    const px = SIZE_PX[size];
    const initial = (name?.trim()[0] ?? '?').toUpperCase();
    const fontSize = Math.round(px * 0.4);
    return (
        <View
            style={[
                styles.circle,
                {
                    width: px,
                    height: px,
                    borderRadius: px / 2,
                    backgroundColor: color,
                    borderWidth: borderColor ? 1.5 : 0,
                    borderColor: borderColor ?? 'transparent',
                },
            ]}>
            <ThemedText
                style={[
                    styles.initial,
                    {
                        color: '#FFFFFF',
                        fontSize,
                        // SemiBold for the initial — the design uses 600 weight
                        // so the letter reads as identity at small sizes.
                        fontFamily: FontFamily.sansSemiBold,
                    },
                ]}>
                {initial}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    initial: {
        fontWeight: '600',
        letterSpacing: -0.2,
        // RN center alignment can look optically off — small adjustment to
        // pull the glyph back to the visual middle of the circle.
        lineHeight: undefined,
        includeFontPadding: false,
    },
});

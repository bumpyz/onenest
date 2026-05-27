// PriorityFlag — small icon used inside the 28×28 left tile of PrioritySheet
// rows AND in the Details `Priority` row (when we surface a tile there).
// Two variants:
//   * 'flag'           — design's chevron-flag shape (`M3 12V3l4 3 4-3v9`)
//     used for Low / Normal / High / Urgent rows.
//   * 'dashed-circle'  — open dashed ring used for the None row, signaling
//     "no priority set".
//
// Implemented as Feather glyphs since react-native-svg isn't a dependency
// yet — `flag` from Feather is the closest match to the design's bookmark/
// flag shape; 'circle' with dashed stroke isn't available so the dashed
// circle uses a regular View border.

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export function PriorityFlag({
    color,
    variant,
}: {
    color: string;
    variant: 'flag' | 'dashed-circle';
}) {
    if (variant === 'dashed-circle') {
        return (
            <View
                style={[
                    styles.dashedCircle,
                    { borderColor: color },
                ]}
            />
        );
    }
    return <Feather name="flag" size={12} color={color} />;
}

const styles = StyleSheet.create({
    // 10×10 dashed ring, drawn as a View border. Approximation of the
    // design's <circle r=5 strokeDasharray="2 2"> — RN's borderStyle:
    // 'dashed' is implementation-defined per platform but renders close.
    dashedCircle: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1.3,
        borderStyle: 'dashed',
    },
});

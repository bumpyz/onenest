// Shared add / edit form for children in the household. Used by /child/new and
// /child/[id], mirroring the LocationForm pattern. Name is required; birthdate and
// notes are both optional (birthdate is opt-in because some households don't track it
// and some users will be reluctant to enter a kid's DOB into a third-party app).

import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { DateField } from '@/components/datetime-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { CHILDREN_PALETTE } from '@/lib/colors';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';

export type ChildFormValues = {
    displayName: string;
    /** YYYY-MM-DD or '' when unset. */
    birthdate: string;
    notes: string;
    /**
     * Hex #RRGGBB color. null on create (the DB trigger picks one) or when the user
     * hasn't selected anything yet; a real hex on edit (preloaded from the row).
     */
    color: string | null;
};

export type ChildFormSubmit = {
    displayName: string;
    birthdate: string | null;
    notes: string | null;
    /** Null on create lets migration 0020's trigger auto-pick the next palette slot. */
    color: string | null;
};

type Props = {
    headerTitle: string;
    submitLabel?: string;
    initialValues: ChildFormValues;
    onSubmit: (input: ChildFormSubmit) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

export function ChildForm({
    headerTitle,
    submitLabel = 'Save',
    initialValues,
    onSubmit,
    onDelete,
    onCancel,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const [displayName, setDisplayName] = useState(initialValues.displayName);
    const [birthdate, setBirthdate] = useState(initialValues.birthdate);
    const [notes, setNotes] = useState(initialValues.notes);
    const [color, setColor] = useState<string | null>(initialValues.color);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const busy = submitting || deleting;
    const canSubmit = displayName.trim().length > 0 && !busy;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                displayName: displayName.trim(),
                birthdate: birthdate.trim() || null,
                notes: notes.trim() || null,
                color,
            });
        } catch (err) {
            console.error('child submit failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't save", msg);
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete || busy) return;
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm(
                      'Delete this child? Events linked to them will keep the link as historical data but the entry will be removed from your roster.',
                  )
                : await new Promise<boolean>((resolve) => {
                      Alert.alert(
                          'Delete this child?',
                          'Events linked to them will keep the link as historical data but the entry will be removed from your roster.',
                          [
                              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                          ],
                      );
                  });
        if (!confirmed) return;
        setDeleting(true);
        setError(null);
        try {
            await onDelete();
        } catch (err) {
            console.error('child delete failed', err);
            const msg = errorMessage(err);
            if (Platform.OS === 'web') setError(msg);
            else Alert.alert("Couldn't delete", msg);
            setDeleting(false);
        }
    };

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.headerBar}>
                    <Pressable
                        onPress={onCancel}
                        disabled={busy}
                        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}>
                        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold">{headerTitle}</ThemedText>
                    <Pressable
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            pressed && canSubmit && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: canSubmit ? '#6F7FA5' : colors.textSecondary,
                                fontWeight: '600',
                            }}>
                            {submitting ? 'Saving…' : submitLabel}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    {/* Live preview of the badge as the user types / picks a color, so they
                        can see exactly what shows up next to events. Uses the picked color
                        when set, otherwise the first palette slot as a placeholder. */}
                    <View style={styles.previewRow}>
                        <ChildBadge
                            name={displayName || '?'}
                            color={color ?? CHILDREN_PALETTE[0]}
                            size="lg"
                        />
                        <ThemedText themeColor="textSecondary" type="small">
                            {color
                                ? 'This badge appears on events for this child.'
                                : 'We&apos;ll pick a color for you (or choose one below).'}
                        </ThemedText>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Name</ThemedText>
                        <TextInput
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="e.g. Anna"
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                            autoFocus
                            autoCapitalize="words"
                            editable={!busy}
                        />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Color</ThemedText>
                        <View style={styles.swatchRow}>
                            {CHILDREN_PALETTE.map((c) => {
                                const selected = color === c;
                                return (
                                    <Pressable
                                        key={c}
                                        onPress={() => setColor(c)}
                                        disabled={busy}
                                        style={({ pressed }) => [
                                            styles.swatch,
                                            {
                                                backgroundColor: c,
                                                borderColor: selected
                                                    ? colors.text
                                                    : 'transparent',
                                            },
                                            pressed && styles.pressed,
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Birthdate (optional)</ThemedText>
                        <DateField value={birthdate} onChange={setBirthdate} />
                    </View>

                    <View style={styles.field}>
                        <ThemedText type="smallBold">Notes (optional)</ThemedText>
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Allergies, school info, anything worth remembering"
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={3}
                            style={[inputStyle, styles.multiline]}
                            editable={!busy}
                        />
                    </View>

                    {error ? (
                        <ThemedText type="small" style={styles.errorText}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {onDelete ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={busy}
                            style={({ pressed }) => [
                                styles.deleteBtn,
                                pressed && !busy && styles.pressed,
                            ]}>
                            <ThemedText style={styles.deleteText}>
                                {deleting ? 'Deleting…' : 'Delete child'}
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </ScrollView>
            </SafeAreaView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ddd',
    },
    headerBtn: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
    scroll: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
    field: { gap: Spacing.two },
    previewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.three,
    },
    swatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.three,
        paddingVertical: Spacing.one,
    },
    swatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 3,
    },
    multiline: { height: 88, textAlignVertical: 'top', paddingTop: Spacing.two },
    errorText: { color: '#B85D52' },
    deleteBtn: {
        marginTop: Spacing.three,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: '#F3D9D3',
        alignItems: 'center',
    },
    deleteText: { color: '#B85D52', fontWeight: '600' },
    pressed: { opacity: 0.7 },
});

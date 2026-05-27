// ChildForm — AddChild create / edit surface (spec 07.2).
//
// Design source: docs/design-handoffs/onenest-spec-v1/
//   design_handoff_creation_flows/screens-creation.jsx::AddChild
//   (~line 612) and the shared scaffold spec at the same dir's README.
//
// Sections, top to bottom (matches canvas 07.2):
//   1. Avatar hero — 80×80 child-color circle + halo + pencil bug +
//      "Tap to upload photo" mono caption. Pencil bug is inert until
//      child photo upload lands (#402 sibling).
//   2. TitleInput "NAME" — accent underline.
//   3. Basics — Birthday (DateField inline + computed age suffix),
//      Pronouns + Nickname (inline TextInput value slots inside
//      FormRows).
//   4. Color — 8-swatch grid using the CHILDREN_PALETTE.
//   5. Who lives with — ParentChip multi-select + "Follows main
//      pattern" FormSwitch. (Adult members of the current household;
//      external co-parent flow will populate once invites land.)
//   6. School — School / Grade / Teacher inline TextInputs.
//   7. Health — allergy HealthChip rack + "+ Add allergy" DashedAddChip
//      that reveals an inline label+severity editor; Medications row
//      links to the medications list (inline editor); Pediatrician
//      chevron is marked "Coming soon" until a contact picker sheet
//      lands.
//   8. Visibility — Caregivers see SegRow (Assigned only / Everything /
//      Custom) + an auto-derived "External co-parents see" display.
//
// What this form does NOT touch:
//   - Real photo upload for the avatar hero (#402 pairs Profile +
//     Child photo uploads).
//   - The Pronouns / School / Pediatrician sheet-based pickers from
//     the canonical spec — inline TextInputs are a temporary shortcut
//     so we don't ship "+chevron with nowhere to go" affordances.
//
// The form callbacks (`onSubmit`, `onSubmitAux`) split scalar fields
// from junction-table writes so the route can run the create / update
// atomically without the form needing to know about Supabase.

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/components/datetime-fields';
import {
    AIHelper,
    ColorSwatch,
    CreateTopBar,
    DashedAddChip,
    FormGroup,
    FormRow,
    FormSectionLabel,
    FormSwitch,
    HealthChip,
    PersonChip,
    SegRow,
    TextInputSheet,
    TitleInput,
} from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Colors, FontFamily, Spacing } from '@/constants/theme';
import { CHILDREN_PALETTE } from '@/lib/colors';
import {
    type AllergySeverity,
    type ChildAllergy,
    type ChildCaregiverVisibility,
    type ChildMedication,
    type HouseholdMember,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';

// ─── Public types ───────────────────────────────────────────────────────

/** Draft set used by both the create + edit routes. Junction-table
 *  fields use plain arrays so the form can treat each as a single
 *  "list of strings" state. */
export type ChildFormValues = {
    displayName: string;
    /** YYYY-MM-DD or '' when unset. */
    birthdate: string;
    notes: string;
    /** Hex #RRGGBB. null lets migration 0020's trigger pick a slot. */
    color: string | null;
    pronouns: string;
    nickname: string;
    school: string;
    grade: string;
    teacher: string;
    followsMainPattern: boolean;
    pediatricianContactId: string | null;
    caregiverVisibility: ChildCaregiverVisibility;
    /** Profile ids the child lives with. */
    livesWith: string[];
    /** Local-only allergy drafts (no id until persisted). */
    allergies: Array<{ id: string | null; label: string; severity: AllergySeverity | null }>;
    /** Local-only medication drafts. */
    medications: Array<{ id: string | null; label: string; dose: string }>;
};

/** Save payload — every field the route needs to persist. The route
 *  diffs against the original to decide which junction rows to add /
 *  remove (a wrapper handles the bulk-replace via setChildLivingWith
 *  and per-row inserts for allergies/medications). */
export type ChildFormSubmit = ChildFormValues;

type Props = {
    headerTitle: string;
    submitLabel?: string;
    initialValues: ChildFormValues;
    /** Household members the child can "live with" — drives the
     *  ParentChip row. The current user is implicitly always selected
     *  by default for new children (handled by the route). */
    members: HouseholdMember[];
    /** Optional: pre-loaded allergies + medications when editing. The
     *  form starts with these in `initialValues` already; this prop is
     *  here to make the API symmetric. */
    onSubmit: (input: ChildFormSubmit) => Promise<void>;
    onDelete?: () => Promise<void>;
    onCancel: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────

function computeAge(birthdate: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
    const [y, m, d] = birthdate.split('-').map(Number);
    const dob = new Date(y, m - 1, d);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const beforeBirthday =
        now.getMonth() < dob.getMonth() ||
        (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
    if (beforeBirthday) age -= 1;
    return age >= 0 ? age : null;
}

/** Spec 07.2 birthday format: "Mar 14, 2018". Year is always shown
 *  because the age suffix that follows ("· 8 yrs") needs the year for
 *  context. Falls back to '' on invalid input — the caller branches on
 *  the empty string to render an "Add birthday" placeholder. */
function formatBirthdayDisplay(birthdate: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return '';
    const [y, m, d] = birthdate.split('-').map(Number);
    const dob = new Date(y, m - 1, d);
    if (Number.isNaN(dob.getTime())) return '';
    return dob.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

const VISIBILITY_OPTIONS: ReadonlyArray<{
    id: ChildCaregiverVisibility;
    label: string;
}> = [
    { id: 'assigned_only', label: 'Assigned only' },
    { id: 'everything', label: 'Everything' },
    { id: 'custom', label: 'Custom' },
];

const SEVERITY_CYCLE: ReadonlyArray<AllergySeverity | null> = [
    null,
    'mild',
    'moderate',
    'severe',
];

function nextSeverity(
    current: AllergySeverity | null,
): AllergySeverity | null {
    const idx = SEVERITY_CYCLE.indexOf(current);
    return SEVERITY_CYCLE[(idx + 1) % SEVERITY_CYCLE.length];
}

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

function severityColor(
    severity: AllergySeverity | null,
    fallback: string,
    palette: Palette,
): string {
    if (severity === 'severe') return palette.alert;
    if (severity === 'moderate') return '#E3A688'; // soft terracotta
    if (severity === 'mild') return '#DDC9A1'; // soft sand
    return fallback;
}

// ─── Component ──────────────────────────────────────────────────────────

export function ChildForm({
    headerTitle,
    submitLabel = 'Save',
    initialValues,
    members,
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
    const [pronouns, setPronouns] = useState(initialValues.pronouns);
    const [nickname, setNickname] = useState(initialValues.nickname);
    const [school, setSchool] = useState(initialValues.school);
    const [grade, setGrade] = useState(initialValues.grade);
    const [teacher, setTeacher] = useState(initialValues.teacher);
    const [followsMainPattern, setFollowsMainPattern] = useState(
        initialValues.followsMainPattern,
    );
    const [caregiverVisibility, setCaregiverVisibility] = useState(
        initialValues.caregiverVisibility,
    );
    const [livesWith, setLivesWith] = useState<string[]>(initialValues.livesWith);
    const [allergies, setAllergies] = useState(initialValues.allergies);
    const [medications, setMedications] = useState(initialValues.medications);
    const [allergyDraft, setAllergyDraft] = useState('');
    const [medicationDraft, setMedicationDraft] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Field-edit sheet state — one shared sheet for the five
    // short-string rows that spec 07.2 renders as chevron rows
    // (Pronouns, Nickname, School, Grade, Teacher). Tap opens the
    // sheet with that field's config; Save commits the draft to the
    // matching scalar setter.
    type EditableField =
        | 'pronouns'
        | 'nickname'
        | 'school'
        | 'grade'
        | 'teacher';
    const [editingField, setEditingField] = useState<EditableField | null>(null);

    const FIELD_CONFIG: Record<
        EditableField,
        {
            title: string;
            label: string;
            placeholder: string;
            mono: boolean;
            autoCapitalize: 'none' | 'sentences' | 'words' | 'characters';
            sub: string;
            getCurrent: () => string;
            setNext: (v: string) => void;
        }
    > = {
        pronouns: {
            title: 'Pronouns',
            label: 'PRONOUNS',
            placeholder: 'e.g. he / him',
            mono: true,
            autoCapitalize: 'none',
            sub: 'Optional. Used in copy that talks about this child.',
            getCurrent: () => pronouns,
            setNext: setPronouns,
        },
        nickname: {
            title: 'Nickname',
            label: 'NICKNAME',
            placeholder: 'Optional',
            mono: false,
            autoCapitalize: 'words',
            sub: 'Surfaced in compact UIs alongside the full name.',
            getCurrent: () => nickname,
            setNext: setNickname,
        },
        school: {
            title: 'School',
            label: 'SCHOOL',
            placeholder: 'e.g. Lincoln Elementary',
            mono: false,
            autoCapitalize: 'words',
            sub: 'Full school name as it appears on parent-facing comms.',
            getCurrent: () => school,
            setNext: setSchool,
        },
        grade: {
            title: 'Grade',
            label: 'GRADE',
            placeholder: 'e.g. 3rd',
            mono: true,
            autoCapitalize: 'words',
            sub: 'Free text — "K", "3rd", "Year 6" all work.',
            getCurrent: () => grade,
            setNext: setGrade,
        },
        teacher: {
            title: 'Teacher',
            label: 'TEACHER',
            placeholder: 'e.g. Ms. Park',
            mono: false,
            autoCapitalize: 'words',
            sub: 'Optional. Helpful when caregivers need to reach the school.',
            getCurrent: () => teacher,
            setNext: setTeacher,
        },
    };

    const activeFieldConfig = editingField ? FIELD_CONFIG[editingField] : null;

    const busy = submitting || deleting;
    const canSubmit = displayName.trim().length > 0 && !busy;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({
                displayName: displayName.trim(),
                birthdate: birthdate.trim(),
                notes: notes.trim(),
                color,
                pronouns: pronouns.trim(),
                nickname: nickname.trim(),
                school: school.trim(),
                grade: grade.trim(),
                teacher: teacher.trim(),
                followsMainPattern,
                pediatricianContactId: initialValues.pediatricianContactId,
                caregiverVisibility,
                livesWith,
                allergies: allergies.filter((a) => a.label.trim().length > 0),
                medications: medications.filter(
                    (m) => m.label.trim().length > 0,
                ),
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

    // ─── Lives-with helpers ─────────────────────────────────────────────

    const toggleLivesWith = (profileId: string) => {
        setLivesWith((prev) =>
            prev.includes(profileId)
                ? prev.filter((id) => id !== profileId)
                : [...prev, profileId],
        );
    };

    // ─── Allergy + medication helpers ───────────────────────────────────

    const addAllergy = () => {
        const label = allergyDraft.trim();
        if (!label) return;
        setAllergies((prev) => [...prev, { id: null, label, severity: null }]);
        setAllergyDraft('');
    };
    const removeAllergy = (index: number) => {
        setAllergies((prev) => prev.filter((_, i) => i !== index));
    };
    const cycleAllergySeverity = (index: number) => {
        setAllergies((prev) =>
            prev.map((a, i) =>
                i === index ? { ...a, severity: nextSeverity(a.severity) } : a,
            ),
        );
    };
    const addMedication = () => {
        const label = medicationDraft.trim();
        if (!label) return;
        setMedications((prev) => [...prev, { id: null, label, dose: '' }]);
        setMedicationDraft('');
    };
    const removeMedication = (index: number) => {
        setMedications((prev) => prev.filter((_, i) => i !== index));
    };

    // ─── Derived display ────────────────────────────────────────────────

    const heroColor = color ?? CHILDREN_PALETTE[0];
    const initial = (displayName.trim().charAt(0) || '?').toUpperCase();
    const age = computeAge(birthdate);

    return (
        <ThemedView style={styles.container}>
            {/* KeyboardAvoidingView: iOS keyboard otherwise covers the lower
                inline TextInputs (school/grade/teacher rows) on a 402×874
                viewport. Audit #330 CRITICAL #2. */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                <CreateTopBar
                    title={headerTitle}
                    saveLabel={submitting ? 'Saving…' : submitLabel}
                    saveDisabled={!canSubmit}
                    onCancel={onCancel}
                    onSave={handleSubmit}
                />

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    {/* AVATAR HERO — 80px child-color circle + halo +
                        pencil bug. Photo upload backend isn't wired yet
                        (paired with #402); the pencil bug renders but
                        is inert. */}
                    <View style={styles.hero}>
                        <View style={styles.heroWrap}>
                            <View
                                style={[
                                    styles.heroOuterHalo,
                                    { backgroundColor: heroColor + '14' },
                                ]}
                            />
                            <View
                                style={[
                                    styles.heroInnerHalo,
                                    { backgroundColor: heroColor + '44' },
                                ]}
                            />
                            <View
                                style={[
                                    styles.heroBadge,
                                    { backgroundColor: heroColor },
                                ]}>
                                <Text style={styles.heroInitial}>{initial}</Text>
                            </View>
                            <View
                                style={[
                                    styles.heroPencil,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <Feather
                                    name="edit-2"
                                    size={11}
                                    color={colors.text}
                                />
                            </View>
                        </View>
                        <ThemedText
                            style={[
                                styles.heroCaption,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoMedium,
                                },
                            ]}>
                            Tap to upload photo
                        </ThemedText>
                    </View>

                    {/* TITLE */}
                    <TitleInput
                        label="NAME"
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="e.g. Theo"
                        autoFocus={!initialValues.displayName}
                        autoCapitalize="words"
                        editable={!busy}
                    />

                    {/* BASICS */}
                    <FormSectionLabel>Basics</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            {/* Birthday — spec 07.2 wants a single
                                FormRow with chevron whose value reads
                                "Mar 14, 2018 · 8 yrs" in mono. Tapping
                                the row opens the platform date picker
                                via DateField's `renderTrigger` API. */}
                            <DateField
                                value={birthdate}
                                onChange={setBirthdate}
                                renderTrigger={({ open }) => (
                                    <FormRow
                                        label="Birthday"
                                        value={
                                            birthdate
                                                ? `${formatBirthdayDisplay(birthdate)}${
                                                      age !== null
                                                          ? ` · ${age} yr${age === 1 ? '' : 's'}`
                                                          : ''
                                                  }`
                                                : 'Add birthday'
                                        }
                                        muted={!birthdate}
                                        chevron
                                        onPress={open}
                                        disabled={busy}
                                    />
                                )}
                            />
                            <FormRow
                                label="Pronouns"
                                value={pronouns || 'Add'}
                                muted={!pronouns}
                                chevron
                                onPress={() => setEditingField('pronouns')}
                                disabled={busy}
                            />
                            <FormRow
                                label="Nickname"
                                value={nickname || 'None'}
                                muted={!nickname}
                                chevron
                                onPress={() => setEditingField('nickname')}
                                disabled={busy}
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* COLOR */}
                    <FormSectionLabel>Color</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.swatchRow}>
                                {CHILDREN_PALETTE.map((c) => (
                                    <ColorSwatch
                                        key={c}
                                        color={c}
                                        selected={color === c}
                                        onPress={() => setColor(c)}
                                        disabled={busy}
                                        label={`Color ${c}`}
                                    />
                                ))}
                            </View>
                            <View
                                style={[
                                    styles.cardFooterCopy,
                                    {
                                        borderTopColor: colors.hair,
                                        borderTopWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.footerCopyText,
                                        { color: colors.inkFaint },
                                    ]}>
                                    Used on this child's events, tasks, and
                                    chips across the family.
                                </ThemedText>
                            </View>
                        </FormGroup>
                    </View>

                    {/* WHO LIVES WITH */}
                    <FormSectionLabel>
                        {`Who ${displayName.trim() || 'they'} ${displayName.trim() ? 'lives' : 'live'} with`}
                    </FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.chipBlock}>
                                <View style={styles.chipRow}>
                                    {members.map((m) => {
                                        const selected = livesWith.includes(
                                            m.profile_id,
                                        );
                                        return (
                                            <PersonChip
                                                key={m.profile_id}
                                                name={m.display_name}
                                                color={
                                                    m.color ?? colors.inkFaint
                                                }
                                                selected={selected}
                                                onPress={() =>
                                                    toggleLivesWith(
                                                        m.profile_id,
                                                    )
                                                }
                                            />
                                        );
                                    })}
                                </View>
                                <ThemedText
                                    style={[
                                        styles.chipExplain,
                                        { color: colors.inkFaint },
                                    ]}>
                                    Tap an external co-parent to enable shared
                                    custody for this child.
                                </ThemedText>
                            </View>
                            <FormRow
                                label="Follows main pattern"
                                value={
                                    <FormSwitch
                                        value={followsMainPattern}
                                        onValueChange={setFollowsMainPattern}
                                        disabled={busy}
                                    />
                                }
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* SCHOOL */}
                    <FormSectionLabel>School</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <FormRow
                                label="School"
                                value={school || 'Add school'}
                                muted={!school}
                                chevron
                                onPress={() => setEditingField('school')}
                                disabled={busy}
                            />
                            <FormRow
                                label="Grade"
                                value={grade || 'Add'}
                                muted={!grade}
                                chevron
                                onPress={() => setEditingField('grade')}
                                disabled={busy}
                            />
                            <FormRow
                                label="Teacher"
                                value={teacher || 'Add'}
                                muted={!teacher}
                                chevron
                                onPress={() => setEditingField('teacher')}
                                disabled={busy}
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* HEALTH */}
                    <FormSectionLabel>Health</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.chipBlock}>
                                <ThemedText
                                    style={[
                                        styles.miniLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    ALLERGIES
                                </ThemedText>
                                <View style={styles.chipRow}>
                                    {allergies.map((a, idx) => (
                                        <Pressable
                                            key={`${a.id ?? 'new'}-${idx}`}
                                            onPress={() =>
                                                cycleAllergySeverity(idx)
                                            }
                                            onLongPress={() =>
                                                removeAllergy(idx)
                                            }
                                            accessibilityLabel={`${a.label}${a.severity ? ` (${a.severity})` : ''} — tap to change severity, long-press to remove`}>
                                            <HealthChip
                                                color={severityColor(
                                                    a.severity,
                                                    heroColor,
                                                    colors,
                                                )}
                                                label={a.label}
                                                severity={
                                                    a.severity
                                                        ? a.severity.toUpperCase()
                                                        : undefined
                                                }
                                            />
                                        </Pressable>
                                    ))}
                                    <DashedAddChip label="+ Add allergy" />
                                </View>
                                <View style={styles.addRow}>
                                    <TextInput
                                        value={allergyDraft}
                                        onChangeText={setAllergyDraft}
                                        placeholder="Type and press +"
                                        placeholderTextColor={colors.inkFaint}
                                        editable={!busy}
                                        onSubmitEditing={addAllergy}
                                        returnKeyType="done"
                                        style={[
                                            styles.addInput,
                                            {
                                                color: colors.text,
                                                borderColor: colors.hair,
                                                backgroundColor:
                                                    colors.backgroundInset,
                                            },
                                        ]}
                                    />
                                    <Pressable
                                        onPress={addAllergy}
                                        disabled={!allergyDraft.trim() || busy}
                                        accessibilityRole="button"
                                        accessibilityLabel="Add allergy"
                                        style={({ pressed }) => [
                                            styles.addBtn,
                                            {
                                                backgroundColor: allergyDraft.trim()
                                                    ? colors.accent
                                                    : colors.backgroundInset,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <Feather
                                            name="plus"
                                            size={14}
                                            color={
                                                allergyDraft.trim()
                                                    ? colors.onAccent
                                                    : colors.inkFaint
                                            }
                                        />
                                    </Pressable>
                                </View>
                            </View>
                            {/* Medications — inline list + add row, same
                                shape as allergies. */}
                            <View
                                style={[
                                    styles.chipBlock,
                                    {
                                        borderTopColor: colors.hair,
                                        borderTopWidth:
                                            StyleSheet.hairlineWidth,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.miniLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    MEDICATIONS
                                </ThemedText>
                                {medications.length > 0 ? (
                                    <View style={styles.medList}>
                                        {medications.map((m, idx) => (
                                            <Pressable
                                                key={`${m.id ?? 'new'}-${idx}`}
                                                onLongPress={() =>
                                                    removeMedication(idx)
                                                }
                                                accessibilityLabel={`${m.label} — long-press to remove`}
                                                style={[
                                                    styles.medRow,
                                                    {
                                                        borderColor: colors.hair,
                                                    },
                                                ]}>
                                                <ThemedText
                                                    style={[
                                                        styles.medLabel,
                                                        {
                                                            color: colors.text,
                                                            fontFamily:
                                                                FontFamily.monoMedium,
                                                        },
                                                    ]}>
                                                    {m.label}
                                                </ThemedText>
                                            </Pressable>
                                        ))}
                                    </View>
                                ) : null}
                                <View style={styles.addRow}>
                                    <TextInput
                                        value={medicationDraft}
                                        onChangeText={setMedicationDraft}
                                        placeholder="e.g. EpiPen"
                                        placeholderTextColor={colors.inkFaint}
                                        editable={!busy}
                                        onSubmitEditing={addMedication}
                                        returnKeyType="done"
                                        style={[
                                            styles.addInput,
                                            {
                                                color: colors.text,
                                                borderColor: colors.hair,
                                                backgroundColor:
                                                    colors.backgroundInset,
                                            },
                                        ]}
                                    />
                                    <Pressable
                                        onPress={addMedication}
                                        disabled={
                                            !medicationDraft.trim() || busy
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel="Add medication"
                                        style={({ pressed }) => [
                                            styles.addBtn,
                                            {
                                                backgroundColor: medicationDraft.trim()
                                                    ? colors.accent
                                                    : colors.backgroundInset,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <Feather
                                            name="plus"
                                            size={14}
                                            color={
                                                medicationDraft.trim()
                                                    ? colors.onAccent
                                                    : colors.inkFaint
                                            }
                                        />
                                    </Pressable>
                                </View>
                            </View>
                            {/* Pediatrician — contact picker isn't built
                                yet (a future sheet that reads from
                                useContacts and exposes a search +
                                "Create new" affordance). Render the row
                                muted "Coming soon" so the affordance
                                shape is preserved without lying. */}
                            <FormRow
                                label="Pediatrician"
                                value="Coming soon"
                                muted
                                chevron
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* VISIBILITY */}
                    <FormSectionLabel>Visibility</FormSectionLabel>
                    <View style={styles.section}>
                        <FormGroup flush>
                            <View style={styles.chipBlock}>
                                <ThemedText
                                    style={[
                                        styles.miniLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    CAREGIVERS SEE
                                </ThemedText>
                                <SegRow
                                    options={VISIBILITY_OPTIONS}
                                    selected={caregiverVisibility}
                                    onSelect={setCaregiverVisibility}
                                    disabled={busy}
                                />
                            </View>
                            <FormRow
                                label="External co-parents see"
                                value={
                                    livesWith.length > 0
                                        ? 'Auto from custody'
                                        : 'Not applicable'
                                }
                                muted
                                last
                            />
                        </FormGroup>
                    </View>

                    {/* NOTES */}
                    <FormSectionLabel>Notes</FormSectionLabel>
                    <View style={styles.section}>
                        <View
                            style={[
                                styles.notesCard,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Anything worth remembering"
                                placeholderTextColor={colors.inkFaint}
                                multiline
                                numberOfLines={3}
                                editable={!busy}
                                style={[styles.notesInput, { color: colors.text }]}
                            />
                        </View>
                    </View>

                    {/* AI parse-paste hint — visual scaffold; backend
                        wiring tracked under #303 / #329. */}
                    <AIHelper example="paste a phrase → name, school, allergies pre-filled" />

                    {error ? (
                        <ThemedText
                            type="small"
                            style={[
                                styles.errorText,
                                { color: BrandColors.error },
                            ]}>
                            {error}
                        </ThemedText>
                    ) : null}

                    {onDelete ? (
                        <Pressable
                            onPress={handleDelete}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel="Delete child"
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
            </KeyboardAvoidingView>

            {/* Shared field-edit sheet — opens for the FormRow + chevron
                rows above (Pronouns / Nickname / School / Grade /
                Teacher). One sheet handles all five since they're
                semantically identical (single short string). */}
            <TextInputSheet
                open={activeFieldConfig !== null}
                title={activeFieldConfig?.title ?? ''}
                fieldLabel={activeFieldConfig?.label ?? ''}
                sub={activeFieldConfig?.sub}
                initialValue={activeFieldConfig?.getCurrent() ?? ''}
                placeholder={activeFieldConfig?.placeholder}
                mono={activeFieldConfig?.mono ?? false}
                autoCapitalize={activeFieldConfig?.autoCapitalize ?? 'sentences'}
                onSave={(next) => {
                    activeFieldConfig?.setNext(next);
                    setEditingField(null);
                }}
                onClose={() => setEditingField(null)}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: Spacing.six },

    // Hero
    hero: { alignItems: 'center', gap: 8, paddingVertical: 20 },
    heroWrap: {
        width: 96,
        height: 96,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    heroOuterHalo: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    heroInnerHalo: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 44,
    },
    heroBadge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroInitial: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansBold,
        fontSize: 32,
        fontWeight: '600',
        letterSpacing: -1,
    },
    heroPencil: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCaption: { fontSize: 11, letterSpacing: -0.1 },

    // Sections
    section: { paddingHorizontal: 16, paddingBottom: 12 },

    // Color swatch row
    swatchRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        padding: 14,
    },
    cardFooterCopy: { padding: 12 },
    footerCopyText: { fontSize: 11, lineHeight: 16 },

    // Chip blocks (Lives with / Allergies / Medications / Caregivers)
    chipBlock: { padding: 12, gap: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chipExplain: { fontSize: 11, lineHeight: 16, marginTop: 2 },
    miniLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // Add row (used by allergies + medications)
    addRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
    addInput: {
        flex: 1,
        height: 36,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        fontSize: 13,
    },
    addBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Medication list
    medList: { gap: 6 },
    medRow: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    medLabel: { fontSize: 12 },

    // Notes
    notesCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 12,
        minHeight: 80,
    },
    notesInput: {
        fontSize: 13,
        lineHeight: 18,
        textAlignVertical: 'top',
    },

    errorText: {
        paddingHorizontal: 16,
        paddingTop: Spacing.two,
    },

    // Destructive
    deleteBtn: {
        marginTop: Spacing.three,
        marginHorizontal: 16,
        paddingVertical: Spacing.three,
        borderRadius: Spacing.two,
        backgroundColor: BrandColors.errorBackground,
        alignItems: 'center',
    },
    deleteText: { color: BrandColors.error, fontWeight: '600' },
    pressed: { opacity: 0.7 },
});

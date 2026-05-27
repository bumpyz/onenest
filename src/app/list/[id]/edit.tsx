import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

import { ListForm, type ListFormSubmit, type ListFormValues } from '@/components/list-form';
import { LoadingScreen } from '@/components/loading-screen';
import { useHouseholdTasks } from '@/hooks/use-household-tasks';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { deleteList, updateList } from '@/lib/db';
import { useAuth } from '@/providers/auth-provider';

export default function EditListScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { lists, isLoading: listsLoading, refetch: refetchLists } = useLists(
        household?.id,
    );
    // Pull open tasks (openOnly=true) so the delete-confirm count reflects what's
    // actually at risk of being orphaned into Inbox. Completed tasks would also move
    // but warning about them isn't useful.
    const { tasks, isLoading: tasksLoading } = useHouseholdTasks(household?.id, {
        openOnly: true,
    });

    const list = useMemo(
        () => lists?.find((l) => l.id === id) ?? null,
        [lists, id],
    );

    // Count of open tasks on this list — passed to the form for delete-confirm copy.
    // With multi-list, a task is "on this list" if it's a member. Inbox additionally
    // absorbs tasks whose list_ids is empty (orphaned by a previous list delete).
    const taskCount = useMemo(() => {
        if (!list || !tasks) return 0;
        let n = 0;
        for (const t of tasks) {
            if (t.list_ids.includes(list.id)) n += 1;
            else if (list.is_default && t.list_ids.length === 0) n += 1;
        }
        return n;
    }, [list, tasks]);

    // UX-013: only block on the INITIAL hydration. Subsequent refetches (e.g.
    // after Move up/down rewrites two sort_order rows and we await
    // refetchLists()) flip listsLoading back to true, but we don't want the
    // ListForm to unmount in that case — it would lose any unsaved
    // name/color edit, scroll to top, and flash a centered LoadingScreen. We
    // flip `hasHydratedRef` on the first time we see non-loading + a found
    // list, and from then on we just leave the form mounted regardless of
    // refetch state.
    const hasHydratedRef = useRef(false);
    const stillLoadingInitial =
        authLoading || householdsLoading || listsLoading || tasksLoading;
    useEffect(() => {
        if (!stillLoadingInitial && list) hasHydratedRef.current = true;
    }, [stillLoadingInitial, list]);
    if (stillLoadingInitial && !hasHydratedRef.current) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // The list may have been deleted in another tab; bounce back rather than
    // crash. We only treat null as "deleted" after the initial hydration —
    // before that, `lists` is still null and the list legitimately hasn't
    // resolved yet.
    if (hasHydratedRef.current && !list) return <Redirect href="/lists" />;
    // Defensive: shouldn't happen given the gate above, but TS doesn't know
    // hasHydratedRef.current implies list is set.
    if (!list) return <LoadingScreen />;

    const initialValues: ListFormValues = {
        name: list.name,
        color: list.color,
    };

    const handleSubmit = async (input: ListFormSubmit) => {
        await updateList(list.id, {
            name: input.name,
            // Only send color when the user actually picked something — passing null
            // through would overwrite the existing color with NULL and then the next
            // insert would reroll via the trigger, which isn't what edit means.
            ...(input.color !== null ? { color: input.color } : {}),
        });
        router.back();
    };

    const handleDelete = async () => {
        await deleteList(list.id);
        router.back();
    };

    // UX-010: compute the editing list's position in the user-visible chip strip.
    // Inbox is pinned at index 0 and isn't movable, so we expose Move up only when
    // there's a non-Inbox neighbor above (index > 1) and Move down only when a
    // neighbor exists below. Inbox itself never gets either callback.
    const lists_safe = lists ?? [];
    const currentIdx = lists_safe.findIndex((l) => l.id === list.id);
    const canMoveUp = !list.is_default && currentIdx > 1;
    const canMoveDown =
        !list.is_default && currentIdx >= 1 && currentIdx < lists_safe.length - 1;

    /** Swaps the editing list's sort_order with the adjacent neighbor's, then
     *  refetches. Two-row update (rather than re-numerating the whole strip)
     *  keeps the write small and avoids touching unrelated rows. */
    const swapWithNeighbor = async (offset: -1 | 1) => {
        if (!lists) return;
        const neighbor = lists_safe[currentIdx + offset];
        if (!neighbor || neighbor.is_default) return;
        // Snapshot the values first so an in-progress write to one row can't
        // race with the read for the other.
        const myOrder = list.sort_order;
        const theirOrder = neighbor.sort_order;
        await updateList(list.id, { sortOrder: theirOrder });
        await updateList(neighbor.id, { sortOrder: myOrder });
        await refetchLists();
    };

    return (
        <ListForm
            headerTitle="Edit list"
            initialValues={initialValues}
            isDefault={list.is_default}
            taskCount={taskCount}
            onMoveUp={canMoveUp ? () => swapWithNeighbor(-1) : undefined}
            onMoveDown={canMoveDown ? () => swapWithNeighbor(1) : undefined}
            onSubmit={handleSubmit}
            // Inbox gets no onDelete so the form hides the destructive action entirely.
            onDelete={list.is_default ? undefined : handleDelete}
            onCancel={() => router.back()}
        />
    );
}

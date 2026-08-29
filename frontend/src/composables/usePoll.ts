/**
 * The one question still owed to this player, and where their answer goes.
 *
 * Module-scoped refs, like useWhatsNew: one card is mounted, but a second
 * reader would otherwise hold an answered list that never updates.
 *
 * Every storage access is wrapped — localStorage throws in a private window
 * and wherever a browser blocks site data. A player in that state is asked
 * again on their next visit rather than shown a crash.
 */

import { ref, computed } from 'vue'
import { POLLS, nextPoll, type Poll } from '../data/polls'
import { supabase } from '../lib/supabase'

const ANSWERED_KEY = 'om-poll-answered'

function readAnswered(): string[] {
    try {
        const raw = window.localStorage.getItem(ANSWERED_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
        return []
    }
}

const answered = ref<string[]>(readAnswered())

/**
 * Retires a question for this browser. Not a security boundary: clearing site
 * data asks again, and the vote table's primary key is what stops a second
 * answer from counting.
 */
function close(id: string): void {
    if (answered.value.includes(id)) return
    answered.value = [...answered.value, id]
    try {
        window.localStorage.setItem(ANSWERED_KEY, JSON.stringify(answered.value))
    } catch { /* storage blocked — the question comes back next visit */ }
}

export function usePoll() {
    const pending = computed<Poll | null>(() => nextPoll(POLLS, answered.value))

    /**
     * Records the choice, and retires the question either way.
     *
     * A failed insert still closes the card. A question that returns because
     * the network blinked reads as nagging, and one lost answer costs less
     * than that.
     *
     * ponytail: fire and forget. If a poll ever decides something expensive,
     * read the error and retry once before closing.
     */
    async function answer(poll: Poll, choice: string): Promise<void> {
        close(poll.id)
        try {
            await supabase.from('poll_votes').insert({ poll_id: poll.id, choice })
        } catch { /* the answer is lost, the card still closes */ }
    }

    /** Closing the card without answering. The question does not return. */
    function skip(poll: Poll): void {
        close(poll.id)
    }

    return { pending, answer, skip }
}

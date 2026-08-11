// How long a room with no connected players survives before it's garbage-
// collected. Public and private rooms want opposite things:
//  - public rooms back quick-match, so a dead one must leave the pool fast;
//  - private rooms are reached by a shared invite link, so they should linger
//    long enough that a friend clicking the link "later" still lands in the room.
// An hour turned out to be shorter than the way people actually share a link:
// 67 recorded join failures were invite links opened after the room had gone.
// Six hours covers "sent it at lunch, opened it after work" without holding empty
// rooms for days. Public stays at 10 minutes — quick match must never hand out a
// dead room, and that constraint has not changed.
export const ROOM_GC_MS = 10 * 60 * 1000
export const PRIVATE_ROOM_GC_MS = 6 * 60 * 60 * 1000

export function gcWindowMs(isPublic: boolean): number {
    return isPublic ? ROOM_GC_MS : PRIVATE_ROOM_GC_MS
}

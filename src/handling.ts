import { sections } from "./globals";

export type SegmentRange = { startIndex: number; endIndex: number };

export let hoveredSegmentIndex = -1;
export let selectedSegmentIndex = -1;
export let hoveredSegmentRange: SegmentRange | null = null;
export let selectedSegmentRange: SegmentRange | null = null;
export let hoveredFlagId: string | null = null;
export let selectedFlagId: string | null = null;

function getRangeForSegment(index: number): SegmentRange | null {
    const currseg = sections[index];
    if (!currseg || currseg.startpath === undefined || currseg.endpath === undefined) {
        return null;
    }

    return {
        startIndex: Math.min(currseg.startpath, currseg.endpath),
        endIndex: Math.max(currseg.startpath, currseg.endpath),
    };
}

export function resetsegment() {
    hoveredSegmentIndex = -1;
    hoveredSegmentRange = null;
}

export function clearSelectedSegment() {
    selectedSegmentIndex = -1;
    selectedSegmentRange = null;
}

export function clearSegmentState() {
    resetsegment();
    clearSelectedSegment();
}

export function clearFlagState() {
    hoveredFlagId = null;
    selectedFlagId = null;
}

export function setHoveredFlag(id: string | null) {
    hoveredFlagId = id;
}

export function setSelectedFlag(id: string | null) {
    selectedFlagId = id;
}

export function refreshSegmentRanges() {
    hoveredSegmentRange = hoveredSegmentIndex >= 0 ? getRangeForSegment(hoveredSegmentIndex) : null;
    selectedSegmentRange = selectedSegmentIndex >= 0 ? getRangeForSegment(selectedSegmentIndex) : null;
    if (!hoveredSegmentRange) {
        hoveredSegmentIndex = -1;
    }
    if (!selectedSegmentRange) {
        selectedSegmentIndex = -1;
    }
}

export function selectSegment(index: number) {
    const range = getRangeForSegment(index);
    if (!range) {
        resetsegment();
        return;
    }

    hoveredSegmentIndex = index;
    hoveredSegmentRange = range;
}

export function deselectSegment(index: number) {
    resetsegment();
}

export function setSelectedSegment(index: number) {
    const range = getRangeForSegment(index);
    if (!range) {
        clearSelectedSegment();
        return;
    }

    selectedSegmentIndex = index;
    selectedSegmentRange = range;
}

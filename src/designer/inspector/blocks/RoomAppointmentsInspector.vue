<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { RoomAppointments } from '../../../player/room-appointments';
import CalendarField from '../../CalendarField.vue';
import QuickField from '../fields/QuickField.vue';
import { useCalendarChoice } from '../calendar-choice';
import { useInspectorContext } from '../context';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import FontSection from '../FontSection.vue';
import { useInspectorMode } from '../mode';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: RoomAppointments }>();
const context = useInspectorContext();
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, toggleCalendar } = useCalendarChoice(() => props.block);
const rooms = computed(() => [
    ...(context.rooms ?? []),
    ...props.block.roomIds.filter((id) => !context.rooms?.some((r) => r.id === id)).map((id) => ({ id, name: t.inspector.roomHidden(id) })),
]);
const appearances = [
    { value: 'light', label: t.inspector.roomAppointmentsLight },
    { value: 'dark', label: t.inspector.roomAppointmentsDark },
];
function toggleRoom(id: number, on: boolean): void {
    const ids = on ? [...new Set([...props.block.roomIds, id])] : props.block.roomIds.filter((r) => r !== id);
    setBlock({ roomIds: ids.slice(0, 30) });
}
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" @toggle="toggleCalendar" />
    <QuickField quick :label="t.inspector.rooms" :face="t.quick.count(t.inspector.rooms, block.roomIds.length)">
        <fieldset class="room-list">
            <legend>{{ t.inspector.rooms }}</legend>
            <p v-if="context.rooms === null" class="hint">{{ t.common.loading }}</p>
            <p v-else-if="!rooms.length" class="hint">{{ t.inspector.noRoomsChosen }}</p>
            <label v-for="room in rooms" :key="room.id" class="room-choice">
                <input type="checkbox" :checked="block.roomIds.includes(room.id)" :disabled="!block.roomIds.includes(room.id) && block.roomIds.length >= 30" :data-testid="`room-appointments-choice-${room.id}`" @change="toggleRoom(room.id, ($event.target as HTMLInputElement).checked)">
                {{ room.name }}
            </label>
        </fieldset>
    </QuickField>
    <SegmentField quick :model-value="block.appearance ?? 'light'" :options="appearances" :label="t.inspector.appearance" testid="room-appointments-appearance" @update:model-value="setBlock({ appearance: $event })" />
    <NumberField quick :model-value="block.horizonDays" :label="t.inspector.period" :unit="t.inspector.unitDays" :min="1" :max="366" testid="room-appointments-days" @update:model-value="setBlock({ horizonDays: $event })" />
    <NumberField :model-value="block.pageSeconds ?? 10" :label="t.inspector.secondsPerPage" :unit="t.inspector.unitSeconds" :min="3" :max="120" testid="room-appointments-seconds" @update:model-value="setBlock({ pageSeconds: $event })" />
    <p v-if="mode === 'full'" class="hint">{{ t.inspector.roomAppointmentsFilter }}</p>
    <FontSection :block="block" fixed-colors />
</template>

<style scoped>
.room-choice { display: flex; align-items: center; gap: 0.5em; padding: 0.4em 0; }
.room-list { border: 0; padding: 0; margin: 0; min-width: 0; }
.room-list legend { font-weight: 600; padding: 0; }
.hint { margin: 0; color: var(--d-text-muted); font-size: var(--d-size-sm); }
</style>

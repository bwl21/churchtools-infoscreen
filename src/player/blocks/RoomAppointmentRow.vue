<script setup lang="ts">
import { computed } from 'vue';
import type { Appointment } from '../../appointments/normalize';
import { timeRange } from '../format';
import { roomAppointmentDay } from '../room-appointments';

const props = defineProps<{ appointment: Appointment; roomIds: number[]; now: Date; timeZone: string; measuring?: boolean }>();
const rooms = computed(() => props.appointment.bookedRooms?.filter((r) => props.roomIds.includes(r.id)).map((r) => r.name).join(', '));
</script>

<template>
    <li class="row" :data-testid="measuring ? undefined : 'room-appointment-row'">
        <div class="when">
            <span>{{ roomAppointmentDay(appointment, now, timeZone) }}</span>
            <span class="time">{{ timeRange(appointment).replace(' Uhr', '') }}</span>
        </div>
        <div class="body">
            <div class="title">{{ appointment.title }}</div>
            <div v-if="appointment.subtitle" class="subtitle" :data-testid="measuring ? undefined : 'room-appointment-subtitle'">{{ appointment.subtitle }}</div>
        </div>
        <div class="rooms" :data-testid="measuring ? undefined : 'room-appointment-room'">{{ rooms }}</div>
    </li>
</template>

<style scoped>
.row {
    display: grid;
    grid-template-columns: 6.5em minmax(0, 1fr) minmax(0, 0.4fr);
    gap: 0.7em;
    box-sizing: border-box;
    min-height: 4.4em;
    padding: 0.9em 0;
    border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    line-height: 1.2;
}
.when { display: flex; flex-direction: column; gap: 0.5em; font-size: 0.85em; font-weight: 400; opacity: 0.75; }
.time { font-size: 0.75em; white-space: nowrap; font-variant-numeric: tabular-nums; opacity: 0.8; }
.body { min-width: 0; }
.title, .subtitle, .rooms { overflow-wrap: anywhere; }
.subtitle { margin-top: 0.3em; font-size: 0.7em; font-weight: 400; opacity: 0.7; }
.rooms { text-align: right; font-size: 0.75em; font-weight: 400; opacity: 0.8; }
</style>

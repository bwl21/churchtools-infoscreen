<script setup lang="ts">
/** Local pages use the same measured rows as the visible list; no appointment is cut between pages. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { tp } from '../../i18n/player';
import { useStageContext } from '../context';
import { textStyle } from '../format';
import { PAGE_SECONDS, pageInterval, paginateByHeight } from '../paging';
import { roomAppointments, type RoomAppointments } from '../room-appointments';
import RoomAppointmentRow from './RoomAppointmentRow.vue';

const props = defineProps<{ block: RoomAppointments; slideSeconds?: number }>();
const context = useStageContext();
const items = computed(() => roomAppointments(context.appointments, props.block, context.now, context.timeZone));
const measureList = ref<HTMLElement | null>(null);
const heights = ref<number[]>([]);
const page = ref(0);
const seconds = ref(0);
const padding = computed(() => props.block.style.fontSize * 0.75);
const pages = computed(() => paginateByHeight(items.value, heights.value, props.block.height - padding.value * 2, props.block.style.fontSize * 0.8));
const shown = computed(() => pages.value[page.value % pages.value.length] ?? []);
const colors = computed(() => props.block.appearance === 'dark'
    ? { color: '#f1f5f9', backgroundColor: '#0f172a' }
    : { color: '#0f172a', backgroundColor: '#ffffff' });
function measure(): void {
    heights.value = [...(measureList.value?.querySelectorAll<HTMLElement>('.row') ?? [])].map((row) => row.offsetHeight);
}
let timer: ReturnType<typeof setInterval> | undefined;
let observer: ResizeObserver | undefined;
function turnPages(): void {
    clearInterval(timer);
    page.value = 0;
    seconds.value = 0;
    if (pages.value.length < 2 || context.paging === false) return;
    seconds.value = pageInterval(props.block.pageSeconds ?? PAGE_SECONDS, props.slideSeconds ?? 0, pages.value.length);
    timer = setInterval(() => { page.value = (page.value + 1) % pages.value.length; }, seconds.value * 1000);
}
watch(() => pages.value.length, (count) => { if (context.pages) context.pages[props.block.id] = count; }, { immediate: true });
watch([() => pages.value.length, () => props.block.pageSeconds, () => props.slideSeconds, () => context.paging, () => items.value.map((a) => a.key).join()], turnPages);
watch([() => props.block.style, () => props.block.width, () => props.block.height, items, () => context.timeZone], () => void nextTick(measure), { deep: true });
onMounted(() => {
    measure();
    turnPages();
    if (typeof ResizeObserver !== 'undefined' && measureList.value) {
        observer = new ResizeObserver(measure);
        observer.observe(measureList.value);
    }
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => {
    clearInterval(timer);
    observer?.disconnect();
    if (context.pages) delete context.pages[props.block.id];
});
</script>

<template>
    <div class="paged" :style="{ ...textStyle(block.style), ...colors, padding: `${padding}px` }" data-testid="room-appointments">
        <ul ref="measureList" class="list measure" aria-hidden="true">
            <RoomAppointmentRow v-for="a in items" :key="a.key" :appointment="a" :room-ids="block.roomIds" :now="context.now" :time-zone="context.timeZone" measuring />
        </ul>
        <Transition name="page" mode="out-in">
            <ul :key="page" class="list">
                <RoomAppointmentRow v-for="a in shown" :key="a.key" :appointment="a" :room-ids="block.roomIds" :now="context.now" :time-zone="context.timeZone" />
                <li v-if="!items.length" class="empty">{{ tp.appointments.noneInRooms }}</li>
            </ul>
        </Transition>
        <div v-if="pages.length > 1" class="pager" role="img" :aria-label="tp.appointments.page(page + 1, pages.length)" :style="{ left: `${padding}px`, right: `${padding}px`, bottom: `${padding}px` }" data-testid="room-appointments-pager">
            <span v-for="(_, index) in pages" :key="index" class="track">
                <span v-if="index < page" class="fill" />
                <span v-else-if="index === page && seconds" :key="`${page}:${seconds}`" class="fill progress" :style="{ animationDuration: `${seconds}s` }" data-testid="room-appointments-progress" />
            </span>
        </div>
    </div>
</template>

<style scoped>
.paged { position: relative; width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; }
.list { list-style: none; margin: 0; padding: 0; width: 100%; }
.measure { position: absolute; visibility: hidden; pointer-events: none; width: calc(100% - 1.5em); }
.empty { margin: 0; font-size: 0.8em; font-weight: 400; opacity: 0.7; }
.pager { position: absolute; display: flex; gap: 0.3em; height: 0.16em; }
.track { flex: 1; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, currentColor 15%, transparent); }
.fill { display: block; height: 100%; background: currentColor; }
.progress { transform-origin: left; animation: room-progress linear forwards; }
@keyframes room-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.page-enter-active, .page-leave-active { transition: opacity 0.4s ease; }
.page-enter-from, .page-leave-to { opacity: 0; }
</style>

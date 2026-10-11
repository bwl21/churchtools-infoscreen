import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, reactive } from 'vue';
import { normalizeAppointments } from '../appointments/normalize';
import { needsAppointmentRooms } from '../appointments/rooms';
import { createBlock } from '../designer/ops';
import { readSlide } from '../model/read';
import { makeScreen, makeSlide } from '../model/testing';
import { SCHEMA_VERSION } from '../model/schema';
import { provideStageContext, type StageContext } from './context';
import { appointmentNeeds } from './data';
import { slideSeconds } from './paging';
import { roomAppointmentDay, roomAppointments, type RoomAppointments } from './room-appointments';
import RoomAppointmentsView from './blocks/RoomAppointmentsView.vue';

const timeZone = 'Europe/Berlin';
const now = new Date('2026-10-11T12:00:00Z');
const rooms = [{ id: 1, name: 'Saal' }, { id: 2, name: 'Saal' }];
function appointment(id: number, roomId = 1, statusId = 2, calendarId = 7) {
    return {
        appointment: {
            base: { id, title: `Termin ${id}`, subtitle: 'Gemeinsam essen', allDay: false, calendar: { id: calendarId, name: 'Veranstaltungen' } },
            calculated: { startDate: '2026-10-12T08:00:00Z', endDate: '2026-10-12T09:00:00Z' },
            bookings: [{ base: { resourceId: roomId, statusId } }],
        },
    };
}
const appointments = normalizeAppointments(Array.from({ length: 7 }, (_, i) => appointment(i + 1)), timeZone, rooms);
function block(extra: Partial<RoomAppointments> = {}): RoomAppointments {
    return { ...(createBlock('room-appointments', { width: 1920, height: 1080 }, [7]) as RoomAppointments), roomIds: [1], height: 350, ...extra };
}
function render(extra: Partial<RoomAppointments> = {}, paging = true) {
    const b = block(extra);
    const context = reactive<StageContext>({ now, timeZone, clockConfirmed: true, churchName: '', appointments: appointments.map((a) => ({ ...a })), media: new Map(), pages: {}, paging });
    const Host = defineComponent({ setup() {
        provideStageContext(context);
        return () => h(RoomAppointmentsView, { block: b, slideSeconds: 8 });
    } });
    return { wrapper: mount(Host), context, block: b };
}

describe('appointments filtered by confirmed room bookings', () => {
    it('filters by IDs, calendar and booking status, even with identical room names', () => {
        const input = normalizeAppointments([appointment(1), appointment(2, 2), appointment(3, 1, 1), appointment(4, 1, 3), appointment(5, 1, 2, 8)], timeZone, rooms);
        expect(input[0]?.bookedRooms).toEqual([{ id: 1, name: 'Saal' }]);
        expect(input[0]?.rooms).toEqual(['Saal']);
        expect(roomAppointments(input, block(), now, timeZone).map((a) => a.baseId)).toEqual([1, 3, 4]);
        expect(roomAppointments(input, block({ roomIds: [] }), now, timeZone).map((a) => a.baseId)).toEqual([3, 4]);
    });

    it('includes appointments without bookings, keeps the calendar filter and leaves the room column empty', async () => {
        const noRoom = (id: number, calendarId = 7) => {
            const item = appointment(id, 1, 2, calendarId);
            item.appointment.bookings = [];
            return item;
        };
        const input = normalizeAppointments([noRoom(6), noRoom(7, 8), appointment(8, 2)], timeZone, rooms);
        expect(roomAppointments(input, block(), now, timeZone).map((a) => a.baseId)).toEqual([6]);
        expect(roomAppointments(input, block({ roomIds: [] }), now, timeZone).map((a) => a.baseId)).toEqual([6]);
        const { wrapper, context } = render({ roomIds: [], height: 1000 });
        context.appointments = input;
        await flushPromises();
        expect(wrapper.get('[data-testid="room-appointment-row"]').text()).toContain('Termin 6');
        expect(wrapper.get('[data-testid="room-appointment-room"]').text()).toBe('');
        wrapper.unmount();
    });

    it('does not lose matches after many appointments in another room', () => {
        const input = normalizeAppointments([...Array.from({ length: 210 }, (_, i) => appointment(i + 10, 2)), appointment(1)], timeZone, rooms);
        expect(roomAppointments(input, block(), now, timeZone)).toHaveLength(1);
    });

    it('uses local dates for today and tomorrow, including the DST change', () => {
        const a = appointments[0]!;
        expect(roomAppointmentDay(a, now, timeZone)).toBe('Morgen');
        expect(roomAppointmentDay(a, a.start, timeZone)).toBe('Heute');
        expect(roomAppointmentDay(a, new Date('2026-10-10T12:00:00Z'), timeZone)).toBe('Mo, 12.10.');
        const dst = normalizeAppointments([{ ...appointment(1), appointment: { ...appointment(1).appointment, calculated: { startDate: '2026-10-25T09:00:00Z', endDate: '2026-10-25T10:00:00Z' } } }], timeZone, rooms)[0]!;
        expect(roomAppointmentDay(dst, new Date('2026-10-24T12:00:00Z'), timeZone)).toBe('Morgen');
    });

    it('reads and validates the new block and requests its existing calendar/room data', () => {
        const b = block();
        const slide = makeSlide({ blocks: [b] });
        expect(SCHEMA_VERSION.minor).toBeGreaterThanOrEqual(34);
        expect(readSlide(slide).issues).toHaveLength(0);
        expect(readSlide({ ...slide, blocks: [{ ...b, appearance: 'unknown' }] }).issues).not.toHaveLength(0);
        expect(readSlide({ ...slide, blocks: [{ ...b, pageSeconds: 2 }] }).issues).not.toHaveLength(0);
        expect(appointmentNeeds(makeScreen(), [slide], [])).toMatchObject({ calendarIds: [7], days: 14, rooms: true });
        expect(needsAppointmentRooms([block({ roomIds: [] })])).toBe(true);
    });
});

describe('local room appointment pages', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('row') ? 100 : 0; });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

    it('shows subtitle and room, turns whole rows with segmented progress, and keeps the slide for all pages', async () => {
        const { wrapper, context, block: b } = render();
        await flushPromises();
        expect(wrapper.findAll('[data-testid="room-appointment-row"]')).toHaveLength(2);
        expect(wrapper.get('[data-testid="room-appointment-subtitle"]').text()).toBe('Gemeinsam essen');
        expect(wrapper.get('[data-testid="room-appointment-room"]').text()).toBe('Saal');
        expect(context.pages?.[b.id]).toBe(4);
        expect(wrapper.findAll('.track')).toHaveLength(4);
        expect(wrapper.get('[data-testid="room-appointments-progress"]').attributes('style')).toContain('10s');
        expect(slideSeconds(makeSlide({ durationSeconds: 8, blocks: [b] }), context.pages!)).toBe(40);
        context.now = new Date(now.getTime() + 1000);
        await vi.advanceTimersByTimeAsync(10000);
        expect(wrapper.get('[data-testid="room-appointments-pager"]').attributes('aria-label')).toBe('Seite 2 von 4');
        expect(wrapper.findAll('[data-testid="room-appointment-row"]')[0]?.text()).toContain('Termin 3');
        await vi.advanceTimersByTimeAsync(30000);
        expect(wrapper.get('[data-testid="room-appointments-pager"]').attributes('aria-label')).toBe('Seite 1 von 4');
        wrapper.unmount();
        expect(context.pages?.[b.id]).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('holds the first page in the designer and uses the dark surface', async () => {
        const { wrapper } = render({ appearance: 'dark' }, false);
        await flushPromises();
        expect(wrapper.get('[data-testid="room-appointments"]').attributes('style')).toContain('background-color: rgb(15, 23, 42)');
        expect(wrapper.find('[data-testid="room-appointments-progress"]').exists()).toBe(false);
        await vi.advanceTimersByTimeAsync(30000);
        expect(wrapper.get('[data-testid="room-appointments-pager"]').attributes('aria-label')).toBe('Seite 1 von 4');
        wrapper.unmount();
    });

    it('omits empty subtitles and shows all-day appointments without a clock time', async () => {
        const { wrapper, context } = render({ height: 1000 });
        context.appointments = [{ ...context.appointments[0]!, subtitle: '', allDay: true }];
        await flushPromises();
        expect(wrapper.find('[data-testid="room-appointment-subtitle"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="room-appointment-row"]').text()).toContain('ganztägig');
        expect(wrapper.get('[data-testid="room-appointment-row"]').text()).not.toContain('10:00');
        wrapper.unmount();
    });

    it('shows clear empty states and omits the bar for a single page', async () => {
        const empty = render({ roomIds: [] });
        expect(empty.wrapper.text()).toContain('Keine passenden Termine');
        empty.wrapper.unmount();
        const unmatched = render({ roomIds: [99] });
        expect(unmatched.wrapper.text()).toContain('Keine passenden Termine');
        unmatched.wrapper.unmount();
        const single = render({ height: 1000 });
        await flushPromises();
        expect(single.wrapper.find('[data-testid="room-appointments-pager"]').exists()).toBe(false);
        expect(single.wrapper.get('[data-testid="room-appointments"]').attributes('style')).toContain('background-color: rgb(255, 255, 255)');
        single.wrapper.unmount();
    });
});
